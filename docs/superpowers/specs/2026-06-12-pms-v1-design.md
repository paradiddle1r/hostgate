# HostGate PMS v1 — Design

Date: 2026-06-12 · Status: approved by user ("ok ครับ")

## Goal

Turn HostGate.app from a marketing site + auth/onboarding shell into a **real,
multi-tenant PMS** that signed-up customers can use to run a property. Modeled
on the user's `hotel-pms` (single-tenant, .jsx, 8 themes) but **better**:
TypeScript + typed data layer, true multi-tenant RLS isolation from day one,
user-facing error codes, a clean 2-theme system with premium glass, and Server
Components/actions instead of client-side Supabase everywhere.

**v1 scope (this spec):** foundation (tenant isolation, plan limits, property
codes, error codes, theming, app shell, property switcher) + **rooms** +
**guests** + a **daily-stay booking calendar** with create / edit / check-in /
check-out. This is enough to actually run daily bookings for a small hotel.

**Decided up front (do not re-litigate):**
- Isolation = **RLS in one shared Supabase DB** (`tenant_id` on every table),
  not per-customer databases.
- Premium = **`tenants.plan = 'pro'`**. trial + standard are non-premium.
- Auth / login / onboarding already exist — **do not touch them** beyond
  reading the session and tenant membership.
- Guests are **property-scoped** in v1 (a guest belongs to one property), not
  shared across a tenant's properties. (Revisit if customers ask.)

## Existing foundation (build ON this, don't replace)

Supabase project `xwikaqpdulkscdysgxri`. Tables already present + RLS-locked:
- `tenants` (id, name, slug, **plan** trial|standard|pro, created_by)
- `tenant_members` (tenant_id, user_id, role owner|admin|staff)
- `properties` (id, tenant_id, name, property_type daily|monthly|both,
  address, city, country, currency, **timezone**)
- `room_types` (id, property_id, name, quantity, stay_kind daily|monthly,
  daily_rate, monthly_rate, sort_order)
- `user_profiles` (id→auth.users, display_name, locale th|en, …)

Repo: Next.js 14 App Router + TS + Tailwind. `lib/supabase/{server,client,
middleware}.ts` (getAll/setAll cookie API — chunked-JWT safe). `lib/i18n.tsx`
(`useI18n()` + `pick()`, TH/EN, nested `translations` object). Onboarding
already provisions tenant → property → room_types via `provisionTenant()`.
`/app` is a placeholder that lists the tenant/property/rooms.

## Architecture

### 1. Tenant isolation (RLS, single DB)

Every new PMS table carries **`tenant_id uuid not null`** AND
**`property_id uuid not null`** (tenant_id denormalized so RLS needs no join).

SECURITY DEFINER helper, pinned search_path:
```sql
create function public.auth_tenant_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;
```
Every PMS table gets policies of the form (initplan-wrapped per hotel-pms
perf lessons):
```sql
create policy "<t>_tenant_rw" on public.<t> for all to authenticated
  using  (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));
```
Result: customer A's session literally cannot SELECT/INSERT/UPDATE/DELETE
customer B's rows — "complete data isolation" enforced by Postgres, not app
code. `auth_tenant_ids()` is the single chokepoint.

Writes additionally validate `property_id` belongs to an allowed tenant via a
BEFORE trigger `assert_property_in_tenant()` (prevents a crafted payload from
pinning a row to your tenant_id but another tenant's property_id).

### 2. Plan limits (pro = premium)

`lib/plan.ts` — single source of truth:
```ts
export const PLAN_LIMITS = {
  trial:    { maxProperties: 1, glassThemes: false },
  standard: { maxProperties: 1, glassThemes: false },
  pro:      { maxProperties: 25, glassThemes: true },
} as const
```
Enforced **two layers** (defense in depth, like hotel-pms backup routes):
1. **DB trigger** `enforce_property_limit` BEFORE INSERT on `properties`:
   counts the tenant's properties, reads `tenants.plan`, and
   `raise exception using errcode='HG403', message='HG-PROP-403:limit'`
   when over the cap.
2. **UI**: the "Add property" button is hidden / replaced by an upgrade card
   when `count >= maxProperties`.

### 3. Property codes

Add `properties.code text unique not null`. Auto-generated on insert by trigger
`gen_property_code()`: `UPPER(left(tenant.slug,4)) || '-' || NN` (zero-padded
per-tenant sequence), e.g. `MAYB-01`, `MAYB-02`. Shown in the property switcher,
settings, and **embedded in error codes / support context** so a ticket maps to
a property instantly. Immutable after creation.

### 4. Error-code system (debuggability)

`lib/errors.ts`:
```ts
export type HGErrorCode =
  | 'HG-AUTH-401' | 'HG-AUTH-403'
  | 'HG-PROP-403' | 'HG-PROP-404'
  | 'HG-ROOM-409' | 'HG-ROOM-404'
  | 'HG-BOOK-409' /* room/date conflict */ | 'HG-BOOK-422' | 'HG-BOOK-404'
  | 'HG-GUEST-422'
  | 'HG-PLAN-403' | 'HG-UNKNOWN-500'
export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: HGErrorCode; message: string }
export function fail(code, message): ActionResult<never>
export function hgError(code, message): Error  // for throws; carries .hgCode
```
- Every server action returns `ActionResult<T>` — never throws to the client
  bare.
- DB exceptions use SQLSTATE + an `HG-…:` message prefix; the data layer maps
  them back to a code.
- `<AppErrorBoundary>` (route-level) + the toast system render the code so the
  user can quote `HG-BOOK-409` in support. (UI shows a friendly localized
  message; the code is the small monospace tag.)
- Table `error_log` (tenant-scoped, RLS): `(id, tenant_id, property_id, code,
  message, context jsonb, created_at)`. Server actions best-effort insert on
  failure. Surfaced later in an admin view (not v1 UI, just captured).

### 5. App shell (`/app`)

Replace the placeholder with the PMS shell:
- **Left sidebar** (collapsible, mobile drawer): Calendar · Guests · Rooms ·
  Settings. Role-aware later; v1 shows all to owner/admin/staff.
- **Top bar**: active-**property switcher** (dropdown — one entry for
  non-pro, multiple for pro + an "Add property" affordance gated by plan),
  theme toggle, locale toggle, user menu (sign out).
- **Active-property context**: `ActivePropertyProvider` (client) reads the
  current property id from a cookie (`hg_active_property`), falls back to the
  first property. A server helper `getActiveProperty()` resolves it for RSC +
  server actions and verifies membership. All PMS pages scope to it.

Routes:
```
app/app/
  layout.tsx            ← AppShell: sidebar + topbar + providers + error boundary
  page.tsx              ← redirect to /app/calendar
  calendar/page.tsx     ← the booking grid (flagship)
  guests/page.tsx       ← guest CRM list + detail drawer
  rooms/page.tsx        ← rooms + room-types management
  settings/page.tsx     ← property details, theme, locale, plan/upgrade
```

### 6. Theming

Two base themes `light` / `dark` as CSS custom properties on `:root` +
`[data-theme]`, driven by Tailwind tokens (`bg-surface`, `text-fg`, …). Stored
in `user_profiles.theme` (new column, default `light`). Pro unlocks
`light-glass` / `dark-glass` — frosted translucent surfaces (`backdrop-filter`)
over the animated mesh hostgate already ships. The theme picker shows the two
glass options with a lock + "PRO" badge for non-pro; selection is gated client
(disabled) and the DB column CHECK allows the value but the UI won't set it for
non-pro. Theme applied in `app/app/layout.tsx` via `data-theme` on the shell.

### 7. Data model (new tables)

All carry `id uuid pk`, `tenant_id`, `property_id`, `created_at`, RLS as §1.

- **`rooms`** — individual unit. `(room_type_id, number text, floor int null,
  status text default 'active' check active|inactive, sort_order)`. Unique
  `(property_id, number)`. Auto-generated from a room_type's `quantity` via a
  "Generate rooms" action (e.g. floor-based 101–110) but fully editable.
- **`guests`** — `(full_name, phone, email, id_number, nationality, notes)`.
  Property-scoped. Indexed on phone + lower(full_name) for front-desk search.
- **`bookings`** — the reservation:
  `(code text, room_id uuid null, room_type_id uuid, guest_id uuid null,
    guest_name text, phone text null, check_in date, check_out date,
    status text check pending|confirmed|checked_in|checked_out|cancelled,
    source text default 'direct' check direct|walk_in|ota|web,
    adults int, children int, total_amount numeric null, notes text)`.
  `code` auto-gen `BK-<propcode>-<seq>`. Half-open dates `[check_in, check_out)`.
- **`daily_rates`** — `(room_type_id, date, price numeric)`, unique
  `(room_type_id, date)`. Optional per-date override; calendar rate row +
  booking total fall back to `room_types.daily_rate`.

**Conflict rule:** a room is double-booked if another non-cancelled booking on
the same `room_id` overlaps `[check_in, check_out)`. Enforced in the booking
data layer (select-for-overlap before insert/update) AND a DB EXCLUDE-style
guard trigger raising `HG-BOOK-409`. Bookings with `room_id IS NULL`
(unassigned / pending) don't reserve a specific room yet.

### 8. Calendar (flagship)

Rebuilt in TS/Tailwind (not ported jsx). Server Component loads the active
property's rooms + bookings + rates for the visible window; a client grid
renders:
- Rows = rooms (grouped by room_type / floor), columns = dates (default ~14-day
  window, prev/next + today). Booking bars span their date range, colored by
  status.
- **Today panel**: arrivals / departures / in-house counts + lists, one-click
  check-in / check-out (with success toast + error code on failure).
- Click an empty cell → **New booking** modal (room + dates prefilled). Click a
  bar → edit / check-in / out / cancel.
- Availability + nightly total computed via the rate layer.
- **Mobile**: a list view (today's arrivals / departures / in-house) instead of
  the grid, like hotel-pms `MobileBookingList`.
- Drag-to-move/resize is **out of scope for v1** (click-to-edit first).

### Data-access layer

`lib/db/` typed modules, server-only, used by Server Components + server
actions (never ship service-role to client; all reads go through the user's
RLS-scoped session client):
- `properties.ts` — list/create (plan-limited)/update, getActiveProperty.
- `rooms.ts` — list, generateFromRoomType, CRUD.
- `guests.ts` — search/list/create/update.
- `bookings.ts` — windowed list, create/update/setStatus, conflict check.
- `rates.ts` — rate map for a window, upsert.
Each returns `ActionResult<T>` and maps Postgres errors → HG codes.

## Out of scope for v1 (later phases)

Invoices / Thai tax / receipts, monthly rentals + meters, POS, housekeeping,
chat/AI, reports/analytics, channel manager / OTA sync, drag-drop calendar,
staff-role permission matrix beyond the existing owner/admin/staff, email
notifications. The schema leaves room (tenant_id/property_id everywhere) so
these bolt on without migration pain.

## Testing & verification

- DB: after each migration, run the Supabase **security + performance
  advisors**; assert RLS isolation with a two-user SQL role simulation (user A
  cannot see user B's rows; over-limit property insert raises HG-PROP-403).
- App: `tsc --noEmit` + `next build` green at each milestone. Vitest for the
  pure helpers (conflict detection, code generation, plan limits, rate math).
- Manual: create two tenants, confirm complete data separation in the UI;
  non-pro blocked at 1 property + glass themes locked; pro unlocks both.
- This repo is **public** and the marketing site is **live** — keep `main`
  shippable; do PMS work so the marketing routes stay untouched.

## Build order (for the implementation plan)

1. **Migrations** — `auth_tenant_ids`, property `code` + plan-limit triggers,
   `rooms` / `guests` / `bookings` / `daily_rates` / `error_log`, RLS, indexes,
   `user_profiles.theme`.
2. **Foundation libs** — `lib/errors.ts`, `lib/plan.ts`, `lib/db/*`, active-
   property context + `getActiveProperty()`, theme tokens + provider, toast +
   error boundary, base UI primitives (Button, Modal, Toast, EmptyState,
   Skeleton — TS analogues of the hotel-pms ones).
3. **App shell** — `app/app/layout.tsx` sidebar + topbar + property switcher +
   settings (theme/locale/plan/property details).
4. **Rooms** — management page + generate-from-room-type.
5. **Guests** — list + search + create/edit.
6. **Calendar** — grid + today panel + new/edit booking modal + check-in/out +
   mobile list.
7. **Verify** — advisors, isolation simulation, build, push.
