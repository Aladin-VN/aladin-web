# Sprint M7: Chat API, Chat UI Components, Chat Page

## Files Created

### 1. `src/app/api/chat/route.ts` — Chat API Route
- **GET /api/chat**: Fetches message history for authenticated user. Auto-derives `conversationId` from `conv-${userId}`. Returns up to 100 messages ordered by `createdAt asc`. Marks all INCOMING messages as `isRead = true`.
- **POST /api/chat**: Sends a message. Accepts `{ content, messageType? }`. Creates OUTGOING message. Generates bot INCOMING response with keyword-based replies (orders, credit, products, promotions, delivery, greetings, generic). Bot responses stored with both Vietnamese content and English metadata.
- Uses `extractBearerToken`, `verifyAccessToken`, `sanitizeInput`, `successResponse`, `errorResponse`, `db` — all existing project patterns.

### 2. `src/components/mobile/chat-bubble.tsx` — ChatBubble Component
- Named export `ChatBubble`. Props: `{ message: ChatMessageData, locale: string }`.
- OUTGOING: right-aligned, primary bg, white text, `rounded-tl-sm`.
- INCOMING: left-aligned, muted bg, dark text, `rounded-tr-sm`.
- SYSTEM: centered, small muted text, rounded-full pill.
- Shows image thumbnail when `imageUrl` present.
- QUICK_REPLY type shows a label prefix.
- Supports English via `metadata.contentEn` JSON field.
- Relative time in Vietnamese/English format below bubble.
- Exports `ChatMessageData` type.

### 3. `src/components/mobile/chat-input-bar.tsx` — ChatInputBar Component
- Named export `ChatInputBar`. Props: `{ onSend, disabled?, placeholder? }`.
- Auto-resizing textarea (max 120px, overflow scroll).
- Enter sends (Shift+Enter not needed — single Enter sends).
- Auto-focus on mount via `useEffect`.
- SendHorizontal icon button, disabled when empty or sending.
- Sticky bottom bar with safe-area-inset-bottom padding.
- Proper `useCallback` for handlers, correct dependency arrays.

### 4. `src/components/mobile/period-selector.tsx` — PeriodSelector Component
- Named export `PeriodSelector`. Props: `{ value, onChange, locale }`.
- Options: 7d, 30d, 90d, thisMonth, lastMonth.
- Horizontal scrollable chips (same style as CategoryChips).
- Vietnamese labels: 7 ngày, 30 ngày, 90 ngày, Tháng này, Tháng trước.
- Active chip uses primary bg with primary-foreground text.

### 5. `src/components/mobile/report-kpi-row.tsx` — ReportKPIRow Component
- Named export `ReportKPIRow`. Props: `{ label, labelVi, value, icon?, trend?, variant?, locale }`.
- Horizontal layout: icon | label + trend | value.
- Variant support: default, success (emerald), danger (red).
- Trend shown as green/red percentage with TrendingUp/TrendingDown icons.
- Number values formatted with locale-aware toLocaleString.

### 6. `src/app/m/chat/page.tsx` — Chat Page
- Full chat interface using `flex flex-col h-dvh` for proper layout.
- MobileHeader with "Hỗ trợ ALADIN" / "ALADIN Support" title and online indicator.
- Quick reply chips row: Order status, Credit balance, New products, Promotions.
- Message list with ChatBubble components, auto-scroll to bottom on new messages.
- ChatInputBar at bottom with placeholder text.
- Typing indicator (3 bouncing dots) while bot response loads.
- Loading skeleton state while fetching history.
- Empty state with welcome system message and MessageCircle icon.
- Fetch-once pattern using `hasFetched` ref to prevent duplicate requests.
- Fully i18n Vietnamese/English.

### 7. `src/components/mobile/index.ts` — Updated Exports
- Added Sprint M7 exports: `ChatBubble`, `ChatMessageData`, `ChatInputBar`, `PeriodSelector`, `ReportKPIRow`.

## Lint Result
- **0 new TypeScript/ESLint issues** from Sprint M7 files.
- All 8 pre-existing issues remain in unrelated files (download/generate-guide.js, audit-submit-form.tsx, promo-status-badge.tsx, promotion-detail-drawer.tsx, app-provider.tsx).
