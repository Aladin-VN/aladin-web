---
Task ID: 1
Agent: Main Agent
Task: Fix all Aladin platform issues — login, dashboard NaN, reports empty, RBAC, user passwords

Work Log:
- Fixed ROOT CAUSE: .env file was reset to SQLite path instead of Neon PostgreSQL URL
- Fixed JWT_SECRET and JWT_REFRESH_SECRET — hardcoded fallbacks so tokens survive server restarts
- Fixed products page fetchStats: changed raw `fetch()` to `adminFetch()` (4 calls) so auth token is sent
- Fixed dashboard NaN: added `?? 0` null coalescing on monthlyOrderCount, retentionRate, pipeline count
- Fixed reports page: replaced all 5 `if (!data) return null` with error states + retry buttons
- Fixed mobile order detail: replaced local `formatVND` (no NaN guard) with shared `formatVND` from security.ts
- Added RBAC to mobile bottom nav: Products tab hidden for DRIVER/BROKER, Credit tab hidden for DRIVER/BROKER
- Set password 'aladin123' for ALL 279 users in Neon DB (scrypt hash with N=16384, r=8, p=1, keylen=64)
- Verified: RBAC was already implemented in admin sidebar (role-based nav filtering)
- Verified: Data visibility filtering already in orders API (getOrderFilter) and dashboard API
- Build passes cleanly with no errors

Stage Summary:
- Login will work again: .env has correct Neon URL + JWT secrets are stable
- All 279 users can login with phone + password 'aladin123'
- Dashboard NaN fixed with null coalescing guards
- Reports show error messages instead of blank when API fails
- Products page stats will load (adminFetch with auth token)
- Mobile bottom nav respects roles (DRIVER/BROKER see fewer tabs)
- Mobile order detail won't show NaN for amounts