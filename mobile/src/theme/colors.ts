/**
 * ALADIN B2B Mobile — Color System
 *
 * Centralized color constants as hex strings for react-native compatibility.
 * These are consumed both by NativeWind (className) and React Native (StyleSheet).
 */

export const Colors = {
  // ─── Brand ─────────────────────────────────────────────────────────
  primary: '#2563EB',
  'primary-light': '#3B82F6',
  'primary-dark': '#1D4ED8',
  primaryBackground: '#EFF6FF',

  secondary: '#64748B',
  'secondary-light': '#94A3B8',
  'secondary-dark': '#475569',

  // ─── Semantic ──────────────────────────────────────────────────────
  success: '#059669',
  'success-light': '#10B981',
  'success-background': '#D1FAE5',

  warning: '#D97706',
  'warning-light': '#F59E0B',
  'warning-background': '#FEF3C7',

  danger: '#DC2626',
  'danger-light': '#EF4444',
  'danger-background': '#FEE2E2',

  info: '#2563EB',
  'info-light': '#3B82F6',
  'info-background': '#DBEAFE',

  // ─── Background & Surface ──────────────────────────────────────────
  background: '#F8FAFC',
  surface: '#FFFFFF',
  'surface-elevated': '#FFFFFF',
  'surface-muted': '#F1F5F9',
  'surface-border': '#E2E8F0',

  // ─── Text ──────────────────────────────────────────────────────────
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  'text-primary': '#0F172A',
  'text-secondary': '#475569',
  'text-tertiary': '#94A3B8',
  'text-inverse': '#FFFFFF',
  'text-disabled': '#CBD5E1',

  // ─── Order Statuses ────────────────────────────────────────────────
  order: {
    pending: '#D97706',
    'pending-bg': '#FEF3C7',
    confirmed: '#2563EB',
    'confirmed-bg': '#DBEAFE',
    processing: '#7C3AED',
    'processing-bg': '#EDE9FE',
    shipped: '#0891B2',
    'shipped-bg': '#CFFAFE',
    delivered: '#059669',
    'delivered-bg': '#D1FAE5',
    cancelled: '#DC2626',
    'cancelled-bg': '#FEE2E2',
    returned: '#9333EA',
    'returned-bg': '#F3E8FF',
    partial: '#EA580C',
    'partial-bg': '#FFEDD5',
  },

  // ─── Shipment Statuses ─────────────────────────────────────────────
  shipment: {
    draft: '#94A3B8',
    'draft-bg': '#F1F5F9',
    scheduled: '#2563EB',
    'scheduled-bg': '#DBEAFE',
    inTransit: '#0891B2',
    'in-transit-bg': '#CFFAFE',
    outForDelivery: '#7C3AED',
    'out-for-delivery-bg': '#EDE9FE',
    delivered: '#059669',
    'delivered-bg': '#D1FAE5',
    failed: '#DC2626',
    'failed-bg': '#FEE2E2',
    returned: '#9333EA',
    'returned-bg': '#F3E8FF',
  },

  // ─── Credit Statuses ───────────────────────────────────────────────
  credit: {
    active: '#059669',
    'active-bg': '#D1FAE5',
    frozen: '#0891B2',
    'frozen-bg': '#CFFAFE',
    overdue: '#DC2626',
    'overdue-bg': '#FEE2E2',
    blocked: '#7F1D1D',
    'blocked-bg': '#FEE2E2',
    pendingReview: '#D97706',
    'pending-review-bg': '#FEF3C7',
  },

  // ─── UI Primitives ─────────────────────────────────────────────────
  divider: '#E2E8F0',
  placeholder: '#CBD5E1',
  overlay: 'rgba(0, 0, 0, 0.5)',
  'overlay-light': 'rgba(0, 0, 0, 0.3)',

  // ─── Navigation ────────────────────────────────────────────────────
  tabBar: '#FFFFFF',
  'tabBar-active': '#2563EB',
  'tabBar-inactive': '#94A3B8',
  'tabBar-border': '#E2E8F0',

  // ─── Input ─────────────────────────────────────────────────────────
  inputBackground: '#F8FAFC',
  inputBorder: '#CBD5E1',
  'input-border-focused': '#2563EB',
  'input-border-error': '#DC2626',

  // ─── Rating Stars ──────────────────────────────────────────────────
  starFilled: '#F59E0B',
  starEmpty: '#E2E8F0',
} as const;

export type ColorKey = keyof typeof Colors;

/** Helper to get a color with opacity (for react-native) */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default Colors;
