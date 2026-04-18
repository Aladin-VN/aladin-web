# ALADIN Sprint 3E — Zalo Conversation Engine: Orders, Credit, & Payment Flow

## Date: 2026-04-19

## Task: Enhance Zalo Conversation Engine with Orders, Credit, and Enhanced Payment Flow

### Files Modified

1. **`src/lib/zalo/config.ts`** — Added 5 new ConversationState types, session fields for orders/credit/repay context
2. **`src/lib/zalo/conversation-engine.ts`** — Major rewrite (601 → 1574 lines)

### Build Result: ✅ Zero errors — `npx next build` passed successfully

---

### Changes to `config.ts`

- **New ConversationState values**: `AWAITING_ORDER_LOOKUP`, `SHOWING_ORDERS`, `AWAITING_CREDIT_INFO`, `AWAITING_REPAY_ORDER`, `AWAITING_REPAY_AMOUNT`
- **New session fields**: `recentOrders?`, `creditOrders?`, `selectedRepayOrderId?`
- **Updated `resetSession()`**: Clears all new fields

### Changes to `conversation-engine.ts`

#### A. Atomic Order Creation (`handlePaymentState`)
- Uses `db.$transaction` for all order operations (order + items + stock deduction + credit transaction + shop stats)
- Generates proper `ALD-YYYYMMDD-XXX` order numbers with per-day auto-increment (same pattern as admin API)
- Uses `generateIdempotencyKey(zaloUserId)` for idempotency
- Creates `CREDIT_USED` transaction record for credit payments inside the transaction
- Deducts stock atomically inside the transaction
- Updates shop stats (`totalOrders`, `totalGmv`, `avgOrderValue`)
- Builds proper `shopSnapshot` JSON
- 2% discount for DIGITAL payment via `CREDIT_CONFIG.PAY_NOW_DISCOUNT`
- 15,000 VND delivery fee for COD
- Credit validation: checks LOCKED/OVERDUE status and available credit before order creation

#### B. Dynamic Payment Method Selection (`handleShowPaymentOptions`)
- Extracted into dedicated helper function
- Checks shop credit status before showing payment options
- Disables 7-Day Credit option when LOCKED, OVERDUE, or insufficient credit
- Shows available credit amount next to the credit option
- Warns when available credit < order total
- Removes credit option from quick replies when disabled

#### C. "orders" / "đơn hàng" Command (`handleOrdersCommand`)
- Fetches 5 most recent orders for the shop (order by createdAt desc)
- Displays with status icons (⏳✅⚙️📦🚚✅❌🔄), item count, total, payment method
- Status labels in Vietnamese (CHỜ XÁC NHẬN, ĐÃ GIAO, etc.)
- Supports selecting by number to see full detail
- Order detail includes: items list, subtotal/discount/delivery/total, payment method, credit remaining, order date
- Bilingual (vi/en)

#### D. "credit" / "tín dụng" Command (`handleCreditCommand`)
- Uses `getShopCreditInfo(shopId)` from credit-engine
- Shows credit dashboard: limit, used, available, status, days until due
- Status icons: 🟢 ACTIVE, 🔴 LOCKED/OVERDUE
- Vietnamese status labels: HOẠT ĐỘNG, BỊ KHÓA, QUÁ HẠN
- Smart due date messaging: Today! (0 days), X ngày nữa (>2), overdue warning
- OVERDUE: warns about permanent lock risk
- LOCKED: explains auto-unlock on repayment
- Zero balance: encourages credit usage
- Bilingual (vi/en)

#### E. "repay" / "trả nợ" Command (`handleRepayCommand`)
- Checks for outstanding credit balance > 0
- Queries CREDIT_USED transactions and subtracts REPAYMENT transactions per order
- Lists unpaid credit orders with amounts and due dates
- Total debt summary
- Select order by number → enter amount (or "tất cả"/"all" for full repayment)
- Vietnamese number parsing: removes dots/spaces for "100.000" format
- Processes repayment via `db.$transaction` (atomic):
  - Creates REPAYMENT transaction record (negative amount)
  - Updates shop creditBalance
  - Auto-reactivates credit from LOCKED/OVERDUE on full repayment
- Shows success with remaining balance and celebration on full repayment
- Bilingual (vi/en)

#### F. Updated Help Text
- Added: "đơn hàng" / "orders" — Xem đơn gần đây
- Added: "tín dụng" / "credit" — Xem tài khoản tín dụng
- Added: "trả nợ" / "repay" — Thanh toán nợ

#### G. Updated State Machine
- All 5 new states handled in switch statement
- ORDER_CONFIRMED intercepts orders/credit/repay commands
- AWAITING_CREDIT_INFO intercepts repay/orders commands
- Back/cancel navigation in all new states

#### H. Helper Functions
- `getStatusLabelVi()` — Maps order statuses to Vietnamese labels
- `formatDate()` — Date formatting for Zalo messages
- `getProductsByCategory` imported (available but not yet wired to category selection)

---

### Key Decisions

1. **Inline transaction vs credit-engine**: Used inline `db.$transaction` for order creation (same pattern as admin API `/api/orders`) to ensure atomicity across order + items + stock + credit + stats. The credit-engine functions (`repayCredit`, `getShopCreditInfo`, etc.) are used for repayment and info lookup where they fit cleanly.

2. **Credit check before payment display**: The payment method screen now dynamically disables the credit option based on real-time shop credit status, preventing user frustration from failed credit orders.

3. **Repayment amount parsing**: Supports Vietnamese-formatted numbers ("100.000"), plain numbers ("100000"), and keyword "tất cả"/"all" for full repayment.

4. **Session state management**: New session fields (`recentOrders`, `creditOrders`, `selectedRepayOrderId`) are properly typed and cleared on reset.

5. **Error recovery**: All new states have back/cancel handlers that gracefully return to IDLE. Credit/repay failures show actionable error messages.

6. **Code organization**: Commands (orders, credit, repay) are extracted into dedicated functions, keeping the state machine router clean and readable.

### Issues Encountered
- **None** — Build passed on first attempt with zero errors.

## Date: 2025-07-13

## Task: Build the Orders API (6 endpoints)

### Files Created

1. **`src/app/api/orders/route.ts`** — GET (list) + POST (create)
2. **`src/app/api/orders/[id]/route.ts`** — GET (detail)
3. **`src/app/api/orders/[id]/status/route.ts`** — PATCH (status transition)
4. **`src/app/api/orders/[id]/cancel/route.ts`** — PATCH (cancel)
5. **`src/app/api/orders/stats/route.ts`** — GET (statistics)

### Build Result: ✅ Zero errors, zero lint warnings

---

### Endpoint Details

### 1. GET /api/orders — List Orders
- **Auth**: Any authenticated user
- **Query params**: `page`, `limit`, `search` (order number or shop name), `status`, `paymentMethod`, `paymentStatus`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`
- **Response**: Paginated `OrderSummary[]` with formatted VND amounts
- **Performance**: Parallel count query (`Promise.all`)
- **Default sort**: `createdAt desc`

### 2. GET /api/orders/[id] — Order Detail
- **Auth**: Any authenticated user
- **Response**: Full order detail including:
  - Shop info (name, phone, address, district, province)
  - Shop snapshot (historical JSON from order time)
  - All order items with VND-formatted prices
  - Shipment info with assigned driver name/phone
  - Credit transactions (CREDIT_USED, REFUND, REPAYMENT)
  - All monetary fields formatted as VND strings

### 3. POST /api/orders — Create Order
- **Auth**: ADMIN, SALES_REP
- **Input**: `shopId`, `items[]`, `paymentMethod`, `customerNotes`, `idempotencyKey`
- **Business logic**:
  - Validates shop exists, products active, stock availability, min/max qty
  - Credit check: `shop.creditLimit - shop.creditBalance >= totalAmount`
  - Credit lock/overdue check
  - Idempotency: returns existing order if key matches
  - Order number: `ALD-YYYYMMDD-XXX` with auto-increment per day
  - 2% Pay Now discount for `DIGITAL` payment method
  - COD delivery fee: 15,000 VND; others: 0
  - Shop snapshot JSON (name, phone, address, district, province, shopType)
  - Stock deduction per item in transaction
  - Credit transaction creation + shop creditBalance update in same `$transaction`
  - Auto-locks shop credit when balance reaches limit
  - Updates shop stats (totalOrders, totalGmv, avgOrderValue)
- **Rate limit**: 30 req/min per user

### 4. PATCH /api/orders/[id]/status — Status Transition
- **Auth**: ADMIN, SALES_REP, DRIVER
- **Valid transitions**: `PENDING→CONFIRMED→PROCESSING→PACKED→OUT_FOR_DELIVERY→DELIVERED`
- **Timestamps**: Sets `confirmedAt`, `packedAt`, `deliveredAt` as appropriate
- **On DELIVERED**: Sets `paymentStatus = PENDING` for CREDIT orders (7-day timer)
- **On DELIVERED**: Recalculates shop `totalGmv` and `avgOrderValue` from all delivered orders
- **Rate limit**: 60 req/min per user

### 5. PATCH /api/orders/[id]/cancel — Cancel Order
- **Auth**: ADMIN, SALES_REP
- **Cancellable statuses**: PENDING, CONFIRMED only
- **Business logic** (all in `$transaction`):
  - Sets status=CANCELLED, cancelledAt, cancelReason
  - Credit refund: Creates REFUND transaction (negative amount), restores shop creditBalance, re-activates credit status
  - Stock restoration: Increments stockQuantity for each order item
  - Shop stats: Decrements totalOrders, totalGmv; recalculates avgOrderValue
  - Clamps shop totalOrders/GMV/avg to 0 minimum
- **Rate limit**: 30 req/min per user

### 6. GET /api/orders/stats — Order Statistics
- **Auth**: Any authenticated user
- **Optional filter**: `?shopId=...` to scope to one shop
- **Response**:
  - `totalOrders` (non-cancelled)
  - `pendingOrders`
  - `todayOrders` (UTC calendar day)
  - `monthlyOrders` (UTC calendar month)
  - `monthlyGmv` + formatted (delivered orders only)
  - `avgOrderValue` + formatted (all non-cancelled)
  - `ordersByStatus` — full breakdown object
  - `topPaymentMethods` — array with count, totalAmount, formatted
- **Performance**: All 8 queries run in parallel via `Promise.all`

---

## Key Decisions

1. **Followed existing codebase patterns exactly** — Same auth flow (`extractBearerToken → verifyAccessToken → hasRole`), same response format (`successResponse/errorResponse`), same `NextRequest/NextResponse` usage.

2. **All multi-step operations use `db.$transaction()`** — Order creation, status transition on DELIVERED, and cancellation all use Prisma interactive transactions to ensure atomicity.

3. **Parallel count queries** — List endpoint and stats endpoint both use `Promise.all` to run count/aggregation queries alongside data queries.

4. **Order number format** — `ALD-YYYYMMDD-XXX` with per-day auto-increment, scanning for the last order with that prefix.

5. **Credit system safety** — Credit balance is updated atomically inside the order creation transaction. On cancellation, a REFUND transaction is created in the append-only ledger and the balance is restored. Shop is auto-locked when credit balance reaches the limit, and auto-unlocked on cancellation.

6. **Shop stats recalculation** — On DELIVERED, stats are recalculated from all delivered orders (not just incremented) for accuracy. On cancellation, they're decremented with a 0-floor clamp.

7. **VND formatting** — All monetary values in list and detail responses include a `*Formatted` companion field using `formatVND()`.

8. **Input sanitization** — All user-provided string inputs (customerNotes, cancelReason, search terms) are sanitized via `sanitizeInput()`.

9. **Rate limiting** — All mutation endpoints have rate limiting keyed on user ID. Read endpoints don't rate limit (consistent with product routes pattern).

10. **Error handling** — Every endpoint has try/catch with `console.error` logging and consistent error response format. Validation errors return field-level details array.

## Issues Encountered

- **None** — Build and lint passed on first attempt with zero errors.

---

# ALADIN Sprint 3D — Admin Credit & Finance Page

## Date: 2025-07-14

## Task: Build the Admin Credit & Finance Management Page (`/credit`)

### Files Created

1. **`src/app/credit/page.tsx`** — Main credit & finance page with 3 sections
2. **`src/components/credit/credit-status-badge.tsx`** — Reusable ACTIVE/OVERDUE/LOCKED status badge
3. **`src/components/credit/credit-adjust-dialog.tsx`** — Credit limit adjustment dialog with presets
4. **`src/components/credit/transaction-ledger-dialog.tsx`** — Transaction history panel with filters
5. **`src/components/credit/repayment-dialog.tsx`** — Manual repayment recording dialog

### Build Result: ✅ Zero errors — `npx next build` passed successfully

---

## Page Architecture

### Section 1: Credit Summary Cards (4 cards in grid)
- **Total Credit Exposure**: Sum of all shop credit balances with `SensitiveValue` masking
- **Active Credit Lines**: Count of shops with `creditBalance > 0` and `status ACTIVE`
- **Overdue Accounts**: Count with red/warning styling when > 0, shows locked count as sub-info
- **Collection Rate**: Percentage with color coding (≥80% green, ≥50% amber, <50% red)
- Fetches from `GET /api/credit/summary`
- Each card uses appropriate icon and color variant matching dashboard pattern

### Section 2: Automation Rules Panel
- 3 rules displayed in a dashed-border card:
  1. **Credit Auto-Lock (Day 7)**: Red icon, "Active" badge
  2. **Day 5 Reminder**: Amber icon, "Active" badge
  3. **Pay Now Discount**: Green icon, "Configured" badge
- "Process Overdue" button calls `POST /api/credit/process-overdue`
- Shows toast on success: "Đã khóa X cửa hàng quá hạn"
- Loading state with spinner on button

### Section 3: Shop Credit Overview Table
- **Tabs**: All Shops | Active | Overdue | Locked (with count badges)
- **Columns**: Shop Name, Credit Limit, Credit Used, Available, Usage %, Status, Due In, Last Activity, Actions
- **Progress bar**: Green < 50%, amber 50-80%, red > 80% via CSS class override on Progress component
- **Status badges**: Custom `CreditStatusBadge` with colored dot
- **Days until due**: Green > 3d, amber 1-3d, red 0/overdue
- **Actions**: "Ledger" button (opens transaction ledger), "Limit" button (opens adjust dialog)
- **All monetary values**: Wrapped in `SensitiveValue` with show/hide toggle
- **Search**: Client-side filtering by shop name, district, province
- **Pagination**: Same pattern as products page
- Fetches from `GET /api/credit/shops?status=...&page=...&limit=...`

### Section 4: Credit Adjustment Dialog
- Shows current shop info (limit, used, available) in 3-column grid
- New limit input with validation (500K–10M VND per `CREDIT_CONFIG`)
- Quick preset buttons: 1M, 2M, 3M, 5M, 10M (highlighted when selected)
- Required reason textarea
- Increase/decrease indicator with color
- Submit calls `POST /api/credit/adjust`
- Success toast with old → new limit

### Section 5: Transaction Ledger Dialog
- Opens as large dialog (max-w-4xl) with shop header and status badge
- Summary bar: Limit, Available, Total Transactions
- Filters: Transaction type dropdown (7 types), date range (from/to), reset button
- "Record Repayment" button in top-right
- Transaction table with columns: Date, Type (colored badge), Amount (+/-), Running Balance, Method, Collected By, Description
- Color-coded amounts: positive (red with ↑ arrow) = debit, negative (green with ↓ arrow) = credit
- All amounts masked with `SensitiveValue`
- Pagination
- Fetches from `GET /api/credit/transactions?shopId=...&type=...&dateFrom=...&dateTo=...`

### Section 6: Manual Repayment Dialog
- Nested inside the transaction ledger dialog
- Order selector dropdown (fetches shop's credit orders)
- Prefills amount when order selected
- Payment method: Cash or Digital
- Optional "Collected By" field
- Submit calls `POST /api/credit/repay`
- Success toast with new balance; special toast for full repayment

---

## Key UI Decisions

1. **Followed existing patterns** — Same layout structure as `products/page.tsx` and `page.tsx`: `AdminSidebar` + `AdminHeader` + `SidebarInset`, same pagination component, same bilingual `t()` helper, same stat card styling.

2. **SensitiveValue everywhere** — All monetary amounts and collector names use the `SensitiveValue` component with show/hide toggle, consistent with the dashboard and sidebar patterns.

3. **Color system** — Emerald for positive/success states, amber for warnings, red for danger/overdue. No blue or indigo used. Consistent with existing codebase.

4. **Progress bar color override** — Used Tailwind class ` [&>div]:bg-*` to dynamically color the progress bar indicator based on utilization percentage.

5. **Dialog composition** — `TransactionLedgerDialog` contains `RepaymentDialog` as a child, passing `onSuccess` to refresh the transaction list after recording a repayment.

6. **Client-side search** — Shop name search is debounced (300ms) and filtered client-side to avoid additional API calls, since the API doesn't support text search on the credit/shops endpoint.

7. **Responsive design** — Table columns progressively hidden at breakpoints (sm/md/lg/xl) for mobile-first experience. Summary cards use 2-col on mobile, 4-col on desktop.

---

# ALADIN Sprint 3C — Admin Orders Management Page Work Log

## Date: 2025-07-13

## Task: Build the Admin Orders Management Page

### Files Created

1. **`src/app/api/shops/route.ts`** — Simple shops list/search API for order creation dialog
2. **`src/components/orders/order-status-badge.tsx`** — Reusable OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge
3. **`src/components/orders/order-detail-drawer.tsx`** — Sheet-based order detail with items, payment, timeline, actions
4. **`src/components/orders/order-create-dialog.tsx`** — Create order dialog with shop selector, product search, cart, payment
5. **`src/app/orders/page.tsx`** — Main orders page with table, filters, stats, pagination, drawer, create dialog

### Build Result: ✅ Zero errors — `✓ Compiled successfully in 6.7s`

---

### Page Features

#### 1. Header Section
- Title "Đơn hàng" / "Orders" (bilingual via `t(en, vi)`)
- Quick stats bar: total orders, pending, processing, delivered today (fetched from `/api/orders/stats`)
- Create Order button (opens dialog)

#### 2. Filters Bar
- Search input (debounced 300ms): searches by order number or shop name
- Status filter dropdown: All, PENDING, CONFIRMED, PROCESSING, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED (with color dots)
- Payment method filter: All, CREDIT, DIGITAL, COD
- Payment status filter: All, PENDING, PAID
- Date range filter (from/to date inputs with calendar icons)
- Reset filters button (appears when any filter is active)

#### 3. Orders Data Table
- Columns: Order #, Shop Name, Status (badge), Payment Method (badge), Payment Status (badge), Items, Total Amount, Date, Actions
- Status badges with specified colors (yellow/blue/indigo/purple/cyan/green/red)
- Payment method badges: CREDIT (blue), DIGITAL (green), COD (orange)
- Amounts formatted as VND with SensitiveValue masking
- Row click opens order detail drawer
- Pagination controls at bottom

#### 4. Order Detail Drawer (Sheet)
- Opens when clicking an order row or View button
- Order header: order number, status badge, created date
- Shop info section: shop name, phone (masked with SensitiveValue), address
- Items table: product name, SKU, unit price, quantity, total price, free qty
- Payment section: method, status, subtotal, discount, delivery fee, total, paid amount, credit used — all with SensitiveValue
- Notes section: customer notes, admin notes
- Status timeline: visual step-by-step progression with timestamps
- Action buttons based on current status (PENDING→Confirm, CONFIRMED→Process, etc.)
- Cancel dialog with required reason textarea
- All amounts use SensitiveValue for masking

#### 5. Create Order Dialog
- Shop selector with search dropdown (name or phone)
- Product search with dropdown results showing SKU, stock, price
- Cart with quantity +/- controls, min/max enforcement, remove button
- Payment method selector: DIGITAL (2% off), CREDIT (7-day), COD (+15K fee)
- Customer notes textarea
- Order summary panel: subtotal, discount, delivery fee, total
- Submit creates order via POST /api/orders with error handling

#### 6. Loading & Empty States
- Skeleton loading for table rows
- Empty state with ShoppingCart icon when no orders match filters
- CTA button to create first order when no filters active
- Error handling with toast notifications (sonner)

---

### Key UI Decisions

1. **Followed products page pattern exactly** — Same layout structure (AdminSidebar + SidebarInset + AdminHeader), same StatCardMini pattern, same filters bar card, same table/pagination, same empty state design.

2. **Bilingual locale** — Uses `const t = (en, vi) => locale === 'vi' ? vi : en` pattern. All labels, buttons, placeholders, tooltips support both Vietnamese and English.

3. **Sensitive data masking** — All monetary amounts and phone numbers use SensitiveValue component with show/hide toggle. Consistent with existing dashboard and products page patterns.

4. **Sheet for detail drawer** — Used Shadcn Sheet component (side="right") with `sm:max-w-lg` override for wider content to fit the items table.

5. **Status timeline** — Visual vertical step indicator showing the order fulfillment pipeline with green completed steps, emerald current step, and muted future steps.

6. **Color-coded filter options** — Status filter dropdown items show colored dots matching badge colors for quick visual identification.

7. **Responsive design** — Mobile-first with `sm:` and `md:` breakpoints. Table columns progressively show on larger screens. Filters wrap on mobile.

8. **Debounced search** — 300ms debounce on order search input using useRef pattern, consistent with products page.

9. **Create dialog product search** — Real-time product search via debounced API call with dropdown results, cart management with min/max qty enforcement.

### Issues Encountered

- **Import error**: Initially imported `Skeleton` from `@/components/ui/separator` instead of `@/components/ui/skeleton` in order-create-dialog.tsx. Fixed immediately and build passed on second run.

---
Task ID: 3E
Agent: full-stack-developer
Task: Enhance Zalo Conversation Engine with Orders, Credit, and Payment Flow

Work Log:
- Updated config.ts with new ConversationState types (AWAITING_ORDER_LOOKUP, SHOWING_ORDERS, AWAITING_CREDIT_INFO, AWAITING_REPAY_ORDER, AWAITING_REPAY_AMOUNT)
- Added recentOrders, creditOrders, selectedRepayOrderId to ConversationSession
- Rewrote conversation-engine.ts with atomic order creation, dynamic payment options, orders/credit/repay commands
- Build result: ✅ Zero errors, zero lint warnings

Stage Summary:
- Conversation engine now fully integrated with credit system
- Shop owners can view orders, check credit, and repay via Zalo
- All payment flows are atomic and idempotent
- Credit health checks prevent over-limit credit orders

---
Task ID: 3F
Agent: main
Task: Sprint 3F — i18n Expansion + Seed Data Verification + Build Verification

Work Log:
- Created `/home/z/my-project/src/lib/zalo/i18n.ts` — translation utility with `t(key, locale, params?)` and `createTranslator(locale)` functions
- Updated `src/messages/vi.json` zaloBot section: expanded from 126 to 135 keys with proper Vietnamese diacritics (source of truth)
- Updated `src/messages/en.json` zaloBot section: expanded from 126 to 135 keys matching vi.json structure
- Rewrote `src/lib/zalo/conversation-engine.ts`:
  - Added `import { createTranslator } from './i18n'`
  - Added `const t = createTranslator(session.language)` in all 14 handler functions
  - Replaced 72 inline `vi ? '...' : '...'` display string ternaries with `t('zaloBot.keyName')` calls
  - Added `statusToKey()` helper for English status label resolution
  - 29 remaining inline ternaries are quick reply button labels (intentionally kept — dual purpose: display + input matching)
  - All business logic, state transitions, database queries preserved unchanged
- Verified seed data: 9 orders, 11+ transactions, 5 shops with all payment/credit states present in `prisma/seed.ts`
- Build verification: `npx next build` — ✓ Compiled successfully in 6.4s, 25 pages, 0 errors, 0 warnings

Stage Summary:
- Conversation engine now consumes centralized i18n message files instead of hardcoded strings
- All Sprint 3 order/credit/repay/payment strings externalized and maintainable
- Quick reply labels remain inline for input matching purposes
- Build passes clean — Sprint 3F complete