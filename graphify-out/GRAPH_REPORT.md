# Graph Report - HostGate.app  (2026-06-14)

## Corpus Check
- 233 files · ~146,675 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1196 nodes · 2352 edges · 76 communities (66 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16b19fc6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 78|Community 78]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 77 edges
2. `getActiveProperty` - 46 edges
3. `useToast()` - 43 edges
4. `pick()` - 36 edges
5. `ActionResult` - 29 edges
6. `ok()` - 24 edges
7. `mapPgError()` - 24 edges
8. `listRooms()` - 23 edges
9. `useAppT()` - 20 edges
10. `Booking` - 17 edges

## Surprising Connections (you probably didn't know these)
- `CalendarClient()` --calls--> `useAppT()`  [EXTRACTED]
  components/app/calendar/CalendarClient.tsx → lib/app-i18n.ts
- `CalendarPage()` --calls--> `getActiveProperty`  [EXTRACTED]
  app/app/calendar/page.tsx → lib/active-property-server.ts
- `CalendarPage()` --calls--> `listRooms()`  [EXTRACTED]
  app/app/calendar/page.tsx → lib/db/rooms.ts
- `CalendarPage()` --calls--> `listRatePlans()`  [EXTRACTED]
  app/app/calendar/page.tsx → lib/db/rate-plans.ts
- `AppShell()` --calls--> `useAppT()`  [EXTRACTED]
  components/app/AppShell.tsx → lib/app-i18n.ts

## Communities (76 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (17): Comparison(), CTA(), FAQ(), Features(), icons, SectionHeader(), HowItWorks(), Integrations (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (29): dependencies, lucide-react, next, react, react-dom, server-only, @supabase/ssr, @supabase/supabase-js (+21 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (8): BAR, BarKey, DOW, ROWS, bodyEn, bodyTh, metadata, title

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (5): ContactView(), metadata, ContactSubmission, submitContact(), supabase

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (12): MaintenanceIssueType, MaintenanceStatus, EMPTY_FORM, FormState, ISSUE_TYPE_MAP, ISSUE_TYPES, issueColor(), IssueTypeChip() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (55): Lang, money(), STR, Lang, money(), STR, createBlankInvoice(), createInvoiceFromBooking() (+47 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (26): createGuest(), Guest, GuestInput, guestStays, searchGuests(), setGuestFlag(), updateGuest(), deleteGuestAction() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): 1. Tenant isolation (RLS, single DB), 2. Plan limits (pro = premium), 3. Property codes, 4. Error-code system (debuggability), 5. App shell (`/app`), 6. Theming, 7. Data model (new tables), 8. Calendar (flagship) (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (11): Code map (PMS), code:block1 (lib/), Conventions, graphify, HostGate.app — Project Library, Migrations (`supabase/migrations/`, applied to xwikaqpdulkscdysgxri via MCP), Multi-tenant model (RLS, single DB), Premium (plan = `pro`) (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (28): code:sql (-- 04_pms_foundation.sql — tenant helper, property codes, pl), code:sql (-- 05_pms_tables.sql), code:sql (create or replace function public.gen_booking_code()), HostGate PMS v1 — Implementation Plan, Milestone 1 — Database foundation, Milestone 2 — Foundation libraries (TypeScript), Milestone 3 — App shell, Milestone 4 — Rooms (floor generator + bulk assign) (+20 more)

### Community 21 - "Community 21"
Cohesion: 0.20
Nodes (7): Button, ButtonProps, Size, sizes, Variant, variants, SpinnerProps

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (14): submitPublicBooking(), BookCheckoutPage(), isDate(), BookLayout(), BookLandingPage(), AvailabilityRow, CreateBookingInput, createPublicBooking() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (14): OTA_NAMES, STR, findDates(), findName(), findPhone(), fullYear(), Hit, iso() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.43
Nodes (6): bookingsInRangeAction(), addDays(), ALLOWED_DAYS, CalendarPage(), listBookings(), getMemberships

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (13): PropertyType, ProvisionInput, ProvisionResult, provisionTenant(), RoomRowInput, RoomTypeInput, slugify(), StayKind (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (39): BatchBillsPage(), collapseToPrimaries(), collapseToPrimaries(), TenantDetailPage(), BookingsPage(), loadAllBookings(), listAllBookings(), getGuestWithBookings() (+31 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (11): A. Front desk, Already shipped in HostGate v1 (foundation), B. Operations, C. Accounting, Cross-cutting decisions to make before Phase C/E, D. Collaboration & admin, E. Channels & guest-facing, F. POS — Mini Bar (separate sub-app) (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (4): Skeleton(), SkeletonProps, SkeletonRowsProps, toLen()

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): bulkManualRateAction(), applyManualRateToRange(), DailyRate, datesInclusive(), rateMap, ok()

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (27): applyPlanToRange(), createRatePlan(), datesInRange(), deleteRatePlan(), listRatePlanRates(), listRatePlans(), RatePlan, RatePlanInput (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (25): adjustStock(), createCategory(), createProduct(), deleteCategory(), deleteProduct(), getSaleItems(), ProductInput, SaleItemInput (+17 more)

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (4): bodyEn, bodyTh, metadata, title

### Community 41 - "Community 41"
Cohesion: 0.11
Nodes (22): HousekeepingType, Priority, BUCKET_ORDER, BUCKET_STR, cap(), DueBucket, FilterKey, FILTERS (+14 more)

### Community 42 - "Community 42"
Cohesion: 0.11
Nodes (23): InvoicesClient(), NotesClient(), AddShiftModal(), buildGrid(), BulkAssignModal(), dateISO(), GridCell, memberLabel() (+15 more)

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (13): createHousekeepingTask(), deleteHousekeepingTask(), HousekeepingInput, HousekeepingStatus, HousekeepingTask, setHousekeepingStatus(), updateHousekeepingTask(), assignTaskToMe() (+5 more)

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (30): AdjustModal(), Num, BkRow, bucket(), buildMonths(), channelOf(), MonthAgg, MonthMeta (+22 more)

### Community 45 - "Community 45"
Cohesion: 0.06
Nodes (44): addProperty(), saveAppearancePrefs(), saveBilling(), savePropertyDetails(), savePropertyProfile(), updateTheme(), AppShell(), HOME (+36 more)

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (19): BillParts, BillResult, calculateBill(), isOpenEnded(), meterUsage(), moveOutSettlement(), r2(), SettlementParts (+11 more)

### Community 47 - "Community 47"
Cohesion: 0.16
Nodes (18): createBookingAction(), createMultiRoomBooking(), setStatusAction(), updateBookingAction(), ISSUE_TYPES, ModalSeed, OTA_OPTIONS, PAYMENT_OPTIONS (+10 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (30): addMeterReading(), BillInput, ContractInput, createBill(), createContract(), deleteBill(), deleteContract(), deleteMeterReading() (+22 more)

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (11): addDays(), barBg(), BookingTooltip(), CalendarClient(), colWidth(), DAY_OPTIONS, dayIdx(), nightsBetween() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.15
Nodes (10): BOOKING_TYPES, DateField, daysFromToday(), isoDate(), SORT_KEYS, SortKey, SOURCES, STATUS_COLOR (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (8): metadata, Footer(), I18nContext, I18nContextValue, I18nProvider(), Locale, TranslationKey, translations

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (28): ActivityPage(), intParam(), KNOWN_PREFIXES, strParam(), PREFIX_COLOR, PREFIX_ICON, ROLE_STR, STR (+20 more)

### Community 53 - "Community 53"
Cohesion: 0.20
Nodes (7): BlogPage(), BlogPost, blogPosts, getPost(), generateMetadata(), PostPage(), PostView()

### Community 54 - "Community 54"
Cohesion: 0.24
Nodes (6): AnimatedCounter(), Reveal(), Variant, avatarBg, Testimonials(), useReveal()

### Community 56 - "Community 56"
Cohesion: 0.24
Nodes (10): listCategories(), listProducts(), listSales(), listStockMovements(), PosInventoryPage(), PosPage(), STR, TABS (+2 more)

### Community 58 - "Community 58"
Cohesion: 0.22
Nodes (15): createShift(), deleteShift(), ShiftAssignment, ShiftInput, ShiftType, BulkAssignInput, bulkAssignShifts(), newShift() (+7 more)

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (4): listMaintenance(), MaintenanceOrder, MaintenancePage(), PERIOD_DAYS

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (6): createSale(), PosCategory, completeSale(), Payment, ReceiptData, STR

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (11): cellValue(), COLUMNS, csvField(), exportBookingsCsv(), exportBookingsExcel(), fileName(), htmlEscape(), neutralize() (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (4): PosProduct, StockMovement, STR, Tr

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (9): PosSale, PosSaleItem, STR, METHOD_COLOR, METHOD_ICON, METHODS, PayMethod, SalesClient() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.24
Nodes (7): listMonthlyRoomTypes(), n(), Num, RoomTypeBrief, STR, TypeCard(), MonthlySetupPage()

### Community 66 - "Community 66"
Cohesion: 0.36
Nodes (7): createMaintenance(), deleteMaintenance(), MaintenanceInput, updateMaintenance(), newMaintenance(), removeMaintenance(), saveMaintenance()

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (6): ACCENTS, DURATIONS, Toast, ToastApi, ToastCtx, ToastKind

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (6): generateBill(), issueBillAction(), BatchBillsClient(), BatchTenant, defaultPeriod(), STR

### Community 69 - "Community 69"
Cohesion: 0.29
Nodes (5): RentalTenant, saveTenantConfig(), CardState, STATE_STYLE, STR

### Community 70 - "Community 70"
Cohesion: 0.52
Nodes (5): nightDates(), nightsBetween(), overlaps(), stayTotal(), r

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (17): editAnnouncement(), getPinnedForBanner(), newAnnouncement(), removeAnnouncement(), requireManager(), Draft, SEVERITIES, STR (+9 more)

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (5): buildContractBody(), ContractTerms, money(), s, RentalsClient()

### Community 73 - "Community 73"
Cohesion: 0.13
Nodes (18): EDGE, NotesWidget(), STR, createNote(), deleteNote(), listNotes(), Note, NoteInput (+10 more)

### Community 78 - "Community 78"
Cohesion: 0.23
Nodes (9): ActionErr, ActionOk, ALL_CODES, fail(), hgError, HGErrorCode, mapPgError(), e (+1 more)

## Knowledge Gaps
- **323 isolated node(s):** `DAY_OPTIONS`, `STR`, `TYPE_BG`, `STATUS_BG`, `ALLOWED_DAYS` (+318 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 0` to `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 23`, `Community 25`, `Community 27`, `Community 37`, `Community 38`, `Community 41`, `Community 42`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 60`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 68`, `Community 69`, `Community 71`, `Community 73`?**
  _High betweenness centrality (0.333) - this node is a cross-community bridge._
- **Why does `useToast()` connect `Community 42` to `Community 5`, `Community 6`, `Community 7`, `Community 27`, `Community 37`, `Community 38`, `Community 41`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 49`, `Community 52`, `Community 60`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 67`, `Community 68`, `Community 69`, `Community 71`, `Community 72`, `Community 73`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `getActiveProperty` connect `Community 45` to `Community 6`, `Community 7`, `Community 24`, `Community 27`, `Community 37`, `Community 38`, `Community 43`, `Community 44`, `Community 47`, `Community 48`, `Community 52`, `Community 56`, `Community 58`, `Community 59`, `Community 63`, `Community 64`, `Community 66`, `Community 71`, `Community 73`, `Community 74`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `DAY_OPTIONS`, `STR`, `TYPE_BG` to the rest of the system?**
  _323 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08658008658008658 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._