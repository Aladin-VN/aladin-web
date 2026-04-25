---
Task ID: M1
Agent: Main Agent
Task: Sprint M1 — Mobile Layout Foundation (PWA, auth, navigation, stores, dashboard)

Work Log:
- Cross-verified sprint plan against full codebase (67 API routes, 21 pages, 85 components, 20 models)
- Identified 5 missing features in original TODO (Brokers, Merchandising Audits, Reports, Driver POD, Cart system)
- Revised 8-sprint plan to cover all 67 APIs
- Created PWA manifest.json with standalone display, portrait orientation, Vietnamese lang
- Created 3 Zustand stores: auth.store.ts (JWT auth with hydrate/refresh), cart.store.ts (persisted with zustand/persist), app.store.ts (locale, notifications, network status, install prompt)
- Created API client (src/lib/mobile/api.ts) with auto-refresh token flow and convenience methods
- Created middleware.ts for auth guards on /m/ routes
- Created mobile UI components: MobileHeader (sticky, back/search/notif/avatar), MobileBottomNav (5 tabs with badge support), NotificationBell, MobileKpiCard
- Created mobile layout (src/app/m/layout.tsx) with PWA metadata, viewport config, bottom nav
- Created MobileShell (network offline banner, PWA install prompt, auth hydration, event listeners)
- Created login page with phone+password form, Zalo login placeholder, show/hide password, i18n
- Created register page with name/phone/shopName/password/confirmPassword, validation
- Created dashboard page with greeting, 4 KPI cards, quick actions grid, credit snapshot, active deals, pending shipments, recent orders list
- Created profile page with user info, shop card, menu items (credit/shipments/group-buy/settings/language), logout
- Created placeholder pages for: products, orders, credit, cart, settings, notifications, shipments, group-buy
- Added mobile CSS utilities: safe-area, viewport height fix, tap highlight, scrollbar hiding, iOS zoom prevention
- Fixed TypeScript errors: added ShopInfo type to UserInfo in auth store
- Fixed lint error: replaced useState+setMounted with useSyncExternalStore for client-only rendering

Stage Summary:
- 20 new files created under /m/ routes
- 3 Zustand stores with full TypeScript typing
- 1 API client with auto-refresh token flow
- 1 middleware for auth guards
- 4 mobile components (header, bottom nav, notification bell, KPI card)
- 0 TypeScript errors, 0 lint errors in M1 files
- 6 pre-existing lint errors in legacy code (not M1)
- All bottom tabs functional with routing
- Auth flow: login → dashboard, register → dashboard
- PWA manifest ready for install
