// ALADIN Authentication Utilities
// JWT + Refresh Token + Password Hashing
// Industry standard security practices

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ROLES, type ApiResponse, errorResponse, successResponse, rateLimit } from './security';

// ============================================
// CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'aladin-platform-jwt-secret-2024-secure-key-do-not-share';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'aladin-platform-refresh-secret-2024-secure-key-do-not-share';

const JWT_CONFIG = {
  accessToken: {
    expiresIn: '15m',       // Short-lived access token
    secret: JWT_SECRET,
  },
  refreshToken: {
    expiresIn: '7d',        // Long-lived refresh token
    secret: JWT_REFRESH_SECRET,
  },
} as const;

// ============================================
// PASSWORD HASHING (Argon2-style via crypto.scrypt)
// ============================================

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, keyHex] = hash.split(':');
  if (!salt || !keyHex) return false;
  
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
  
  return crypto.timingSafeEqual(Buffer.from(keyHex, 'hex'), derivedKey);
}

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

export interface JwtPayload {
  userId: string;
  phone: string;
  role: string;
  shopId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateTokenPair(payload: JwtPayload): TokenPair {
  const accessToken = jwt.sign(payload, JWT_CONFIG.accessToken.secret, {
    expiresIn: JWT_CONFIG.accessToken.expiresIn,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_CONFIG.refreshToken.secret,
    { expiresIn: JWT_CONFIG.refreshToken.expiresIn }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_CONFIG.accessToken.secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_CONFIG.refreshToken.secret) as JwtPayload;
  } catch {
    return null;
  }
}

// ============================================
// AUTH MIDDLEWARE HELPERS
// ============================================

/** Extract Bearer token from Authorization header */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/** Role-based access control check */
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

/** Admin-only check */
export function isAdmin(userRole: string): boolean {
  return userRole === ROLES.ADMIN;
}

/** Check if user can access a specific shop's data */
export function canAccessShop(userRole: string, userId: string, shopUserId: string): boolean {
  if (userRole === ROLES.ADMIN) return true;
  if (userRole === ROLES.SALES_REP) return true; // Reps can see all shops in their territory
  return userId === shopUserId; // Shop owner can only access their own data
}

// ============================================
// AUTH API HANDLERS
// ============================================

import { db } from './db';
import { sanitizeInput, isValidVNPhone } from './security';

export async function registerUser(data: {
  phone: string;
  password: string;
  name: string;
  role?: string;
}) {
  // Rate limit registration attempts
  const rl = rateLimit(`register:${data.phone}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return errorResponse('RATE_LIMITED', 'Too many registration attempts. Please try again later.');
  }

  // Validate phone
  if (!isValidVNPhone(data.phone)) {
    return errorResponse('INVALID_PHONE', 'Please provide a valid Vietnamese phone number.');
  }

  // Check existing user
  const existing = await db.user.findUnique({ where: { phone: data.phone } });
  if (existing) {
    return errorResponse('USER_EXISTS', 'An account with this phone number already exists.');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await db.user.create({
    data: {
      phone: sanitizeInput(data.phone),
      passwordHash,
      name: sanitizeInput(data.name),
      role: data.role || ROLES.SHOP_OWNER,
      status: 'ACTIVE',
    },
  });

  // Generate tokens
  const payload: JwtPayload = { userId: user.id, phone: user.phone, role: user.role };
  const tokens = generateTokenPair(payload);

  // Update last login
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return successResponse({
    user: sanitizeUser(user),
    ...tokens,
  });
}

export async function loginUser(phone: string, password: string) {
  // Rate limit login attempts
  const rl = rateLimit(`login:${phone}`, { maxRequests: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return errorResponse('RATE_LIMITED', 'Too many login attempts. Please try again later.');
  }

  // Find user
  const user = await db.user.findUnique({
    where: { phone },
    include: { shop: true, broker: true },
  });

  if (!user || !user.passwordHash) {
    return errorResponse('INVALID_CREDENTIALS', 'Invalid phone number or password.');
  }

  if (user.status === 'SUSPENDED') {
    return errorResponse('ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact support.');
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return errorResponse('INVALID_CREDENTIALS', 'Invalid phone number or password.');
  }

  // Generate tokens
  const payload: JwtPayload = {
    userId: user.id,
    phone: user.phone,
    role: user.role,
    shopId: user.shop?.id,
  };
  const tokens = generateTokenPair(payload);

  // Update last login
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return successResponse({
    user: sanitizeUser(user),
    ...tokens,
  });
}

export async function refreshToken(refreshTokenString: string) {
  const payload = verifyRefreshToken(refreshTokenString);
  if (!payload) {
    return errorResponse('INVALID_TOKEN', 'Refresh token is invalid or expired.');
  }

  // Verify user still exists and is active
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status !== 'ACTIVE') {
    return errorResponse('USER_NOT_FOUND', 'User not found or account is inactive.');
  }

  // Generate new token pair
  const tokens = generateTokenPair(payload);

  return successResponse({
    ...tokens,
  });
}

// ============================================
// USER SANITIZATION (Remove sensitive fields)
// ============================================

export function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash, deletedAt, ...safeUser } = user;
  return safeUser;
}

// ============================================
// GET CURRENT USER (from request)
// ============================================

export async function getCurrentUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { shop: true, broker: true },
  });

  if (!user || user.deletedAt) return null;

  return sanitizeUser(user as Record<string, unknown>);
}
