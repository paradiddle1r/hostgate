# HostGate.app — Project Library

Read this first. HostGate is a **SaaS productization of the hotel-pms system** —
a marketing site + a real multi-tenant PMS that signed-up customers use to run
their own property. Live at **hostgate.app** (Vercel project `hostgate`,
prj_Z07JaIHygcxUHRaUyVoPvzxlZUdD). Public GitHub repo `paradiddle1r/hostgate`.

> Sibling project: `~/Documents/hotel-pms` is the original single-tenant PMS
> (the user's own hotel). HostGate reimplements its ideas as multi-tenant SaaS,
> in TypeScript, better.

## Stack
- Next.js 14 App Router + **TypeScript** + Tailwind (darkMode: "class").
- Supabase (project **`xwikaqpdulkscdysgxri`**, ap-southeast-1) — Auth +
  Postgres 17, RLS multi-tenant. `@supabase/ssr` (getAll/setAll cookie API —
  chunked-JWT safe; see migration history). **Free tier: pauses when idle and
  reads as EMPTY mid-restore — don't diagnose data loss until ACTIVE_HEALTHY.**
- Bilingual TH/EN via `lib/i18n.tsx` (`useI18n()` + `pick()`, marketing) and
  `lib/app-i18n.ts` (`useAppT()`, the PMS shell).
- Vitest for pure helpers. lucide-react for icons. server-only guard.

## Two layers
1. **Marketing site** — landing/blog/contact/privacy/terms, Apple-style device
   mockups, animated mesh. Routes under `app/` (page, blog, contact, …). Chrome
   (Navbar/Footer/mesh) lives in `components/MarketingChrome.tsx`, which **hides
   itself on `/app/*`** so the PMS gets a clean shell.
2. **Auth + onboarding** — Supabase auth (Google OAuth + email magic link; LINE
   disabled). `/login`, `/signup`, 3-step `/onboarding` wizard →
   `provisionTenant()` creates tenant + membership + property + room_types.
3. **The PMS** (`/app/*`) — the real product. See below.

## Multi-tenant model (RLS, single DB)
Every PMS table carries **`tenant_id` + `property_id`** and is RLS-locked to
`tenant_id in (select auth_tenant_ids())`. `auth_tenant_ids()` (SECURITY
DEFINER, migration 04) is the single isolation chokepoint — customer A cannot
see customer B's rows at the Postgres level. Verified by two-user simulation.

Tables: `tenants` (plan trial|standard|**pro**), `tenant_members`
(owner|admin|staff), `properties` (+ auto `code` like `MMM-01`), `room_types`,
`rooms`, `guests`, `bookings`, `daily_rates`, `error_log`, plus marketing
`contact_submissions`/`waitlist`.

DB guard triggers raise `HG-*` codes the app recovers via `mapPgError`:
- `HG-PROP-403` — property over plan limit (non-pro = 1, pro = 25).
- `HG-PROP-404` — property_id not in the row's tenant.
- `HG-BOOK-409` — room double-booked (overlapping [check_in, check_out)).
Property + booking codes auto-generate via triggers (`MMM-01`, `BK-MMM-01-0001`).

## Premium (plan = `pro`)
`lib/plan.ts` is the source of truth (mirrors the DB limit trigger):
- non-pro → 1 property, light/dark themes only.
- pro → multiple properties + the Apple **liquid-glass** themes
  (`light-glass`/`dark-glass`, `[data-theme$="-glass"] .app-surface` adds
  `backdrop-filter`). Glass options are lock-badged for non-pro in the theme
  toggle; `updateTheme` action re-checks the plan server-side.

## Migrations (`supabase/migrations/`, applied to xwikaqpdulkscdysgxri via MCP)
- `01_auth_and_tenants`, `03_tenants_creator_select` — auth + tenant foundation
  (the first 4 contact/waitlist/regex migrations live only in DB history).
- `04_pms_foundation` — `auth_tenant_ids()`, property `code`, plan-limit
  trigger, `user_profiles.theme`.
- `05_pms_tables` — rooms/guests/bookings/daily_rates/error_log + property↔tenant
  guard, booking-conflict guard, booking-code gen, RLS, indexes.
- `06_pms_fk_indexes_and_revokes` — FK covering indexes + revoke client EXECUTE
  on trigger-only functions (auth_tenant_ids stays authenticated-executable).

## Code map (PMS)
```
lib/
  errors.ts          ActionResult<T> + HG-* codes + mapPgError (recovers codes
                     from trigger exception messages + unique violations)
  plan.ts            PLAN_LIMITS, canAddProperty, glass-theme gating
  rooms-generator.ts floor*100+n numbering (clamped 1..99/floor)
  booking-calc.ts    nights / night dates / overlap / stayTotal(rateMap, base)
  app-i18n.ts        useAppT() — PMS shell strings (TH/EN), separate from i18n.tsx
  active-property.tsx        client context + cookie-backed property switcher
  active-property-server.ts  getMemberships / getActiveProperty / listTenantProperties
  db/{properties,rooms,guests,bookings,rates}.ts  server-only, RLS-scoped,
                     every fn returns ActionResult<T>, maps errors → HG codes
components/app/
  AppShell.tsx       sidebar (+mobile drawer) + topbar; owns live data-theme
  PropertySwitcher / ThemeToggle / LocaleToggle / AppErrorBoundary
  HomeClient / SettingsClient / ComingSoon
  ui/{Button,Modal,Toast,EmptyState,Skeleton,Spinner}.tsx  theme-token primitives
  rooms/RoomsClient.tsx        floor generator wizard + bulk type assign + table
  guests/GuestsClient.tsx      search + add/edit
  calendar/{CalendarClient,BookingModal}.tsx  the flagship grid + today panel
app/app/
  layout.tsx         server shell: user→active property→theme; redirects out
  page.tsx           overview (counts + quick links)
  {calendar,guests,rooms,settings}/{page,actions}.ts(x)
```

## What v1 covers / doesn't
**Does:** tenant isolation, plan limits, property codes, error codes, theming,
app shell + property switcher, **rooms** (floor generator + bulk assign),
**guests** CRM, **daily-stay booking calendar** (create/edit/check-in/out,
conflict-guarded, rate-aware). Spec: `docs/superpowers/specs/2026-06-12-pms-v1-design.md`;
plan: `docs/superpowers/plans/2026-06-12-pms-v1.md`.
**Doesn't (later phases):** invoices/tax, monthly rentals + meters, POS,
housekeeping, chat/AI, reports, channel manager/OTA, drag-drop calendar, LINE
login. Schema leaves tenant_id/property_id room for all of these.

## Conventions
- New migration: write `supabase/migrations/NN_*.sql` AND apply via MCP
  `apply_migration` (keep file ↔ live DB in sync). Run advisors after DDL.
- Every server action returns `ActionResult<T>`; never throw bare to the client.
  UI surfaces `code · message` in a toast.
- PMS UI styles with Tailwind + the `var(--app-*)` theme tokens + `.app-surface`
  (NOT the marketing brand classes). Match `RoomsClient`/`CalendarClient`.
- Verify each milestone: `npx tsc --noEmit` + `npm test` + `npm run build`, and
  an SQL two-user isolation/role simulation for DB changes.

---
*Multi-tenant PMS v1 (foundation + rooms + guests + calendar) shipped 2026-06-12.*

## graphify
Knowledge graph at graphify-out/. For codebase questions run `graphify query
"<question>"` (scoped subgraph) before grepping; `graphify update .` after code
changes (AST-only, no API cost).
