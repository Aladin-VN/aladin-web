import { PrismaClient } from '@prisma/client'

// Hardcoded Neon fallback — ensures DB connection even if .env is corrupted/missing
const NEON_URL = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL || ''

  // Safety: if .env has a non-PostgreSQL URL, use the Neon fallback
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    console.warn('[DB] DATABASE_URL is not PostgreSQL, using Neon fallback')
    connectionString = NEON_URL
  }

  // During build time on Vercel, DATABASE_URL may not be available
  if (!connectionString) {
    connectionString = NEON_URL
  }

  // CRITICAL: Always pass the resolved connection string explicitly to PrismaClient
  // Prisma reads env("DATABASE_URL") from schema.prisma at runtime — if the env var
  // is missing, queries fail silently with 0 results. By passing it here, we
  // guarantee the Neon fallback works even without env var configuration.
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: connectionString,
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db