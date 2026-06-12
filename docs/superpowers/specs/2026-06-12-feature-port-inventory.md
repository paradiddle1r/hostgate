# HostGate ← hotel-pms — Feature Port Inventory & Roadmap

Date: 2026-06-12 · Purpose: catalogue **every** hotel-pms feature and lay out
how to bring each into HostGate's multi-tenant SaaS for customers.

## How porting works here (applies to every feature below)

hotel-pms is **single-tenant** (one hotel, `.jsx` + inline styles, RLS only
gates by role). HostGate is **multi-tenant** (`.tsx`, RLS isolation by
`tenant_id`, top-bar shell, liquid theme). So porting a feature = not a copy;
it's a re-implementation against HostGate's primitives:

1. **DB:** new table(s) carry `tenant_id` + `property_id`, RLS policy
   `tenant_id in (select auth_tenant_ids())`, FK indexes, guard triggers,
   saved as `supabase/migrations/NN_*.sql` + applied via MCP.
2. **Data layer:** `lib/db/<feature>.ts` — server-only, returns
   `ActionResult<T>`, maps Postgres errors → `HG-*` codes.
3. **UI:** a page under `app/app/<feature>/` + a client component using the
   `var(--app-*)` tokens, `app-surface`, the shared `ui/*` primitives, the
   active-property context, and `useAppT()` bilingual strings.
4. **Nav:** add to the top-bar `NAV` in `components/app/AppShell.tsx` (+ the
   mobile drawer), grouped once there are many pages.
5. **Plan-gating** where it's a premium feature (via `lib/plan.ts`).
6. **Verify:** advisors, two-user RLS isolation sim, `tsc` + `build`.

Legend — HostGate status: ✅ done · 🟡 partial · ❌ not started.

---

## A. Front desk

| Feature | What it does (hotel-pms) | hotel-pms tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **Booking calendar** | room×date grid, status bars, today panel, check-in/out | `BookingCalendar.jsx`, `bookings`,`daily_rates` | ✅ basic | Add: **drag-to-move/resize**, **paste-import** (parse Agoda/Booking text → booking), **bulk-rate** range editor, occupancy stats, staff-on-shift strip |
| **Bookings list** | flat filterable list + CSV/Excel/FlowAccount export | `bookings/`, `lib/bookings/export.js` | ❌ | New `app/app/bookings/` reading the same `bookings` table; export lib in TS |
| **Guests CRM** | name/phone/id/nationality, VIP/blacklist, stay history | `guests`, `GuestsClient.jsx` | 🟡 basic | Add VIP/blacklist flags, per-guest stay rollup, link bookings→guest |
| **Rate plans** | named pricing presets (Standard/Weekend/High/Low), apply to date range, cascade trigger | `rate_plans`, `daily_rates.plan_id` | ❌ | New `rate_plans` table + `daily_rates.plan_id` + sync trigger; calendar stripe + BulkRate "apply plan" mode |
| **Monthly rentals** | tenants, per-month bills, payment board, contracts (TH+EN), meter readings, move-out settlement, co-tenants, setup | `rental_tenants`,`rental_bills`,`rental_contracts`,`meter_readings`,`contract_counters`, `rentals/*` | ❌ (big) | Largest module. `property_type='monthly'/'both'` already in schema. Port `lib/rentals.js` math (already unit-tested in hotel-pms), contract body builder, OPEN_ENDED_DATE sentinel |

## B. Operations

| Feature | What it does | tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **Housekeeping** | per-room cleaning queue (dirty→in-progress→clean→inspected), auto-task on checkout, calendar dot, realtime | `housekeeping_tasks`, `housekeeping_room_status` view, checkout trigger | ❌ | New table + view + the checkout trigger; calendar room-status dot; realtime subscription |
| **Work shifts** | staff day/night shift assignments per date | `shift_assignments`,`staff` | ❌ | Needs a `staff` concept — HostGate uses `tenant_members`; decide staff model first (members vs a separate staff table) |
| **Maintenance** | out-of-service history + revenue-lost | OOS bookings (`booking_type='oos'`) | ❌ | bookings already supports an OOS lane; add the report view |

## C. Accounting

| Feature | What it does | tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **Invoices & receipts** | Thai tax invoices, line items, payments, receipts, sequential counters, print pages | `invoices`,`invoice_items`,`payments`,`receipts`,`*_counters`, `lib/invoices.js`, `(print)/print/invoice` | ❌ (big) | Per-tenant counters; company/VAT/bank from property settings; print routes need a no-chrome layout |
| **Reports** | revenue & sales report + range selector | `reports/` | ❌ | Aggregate queries scoped to active property |
| **FlowAccount sync** | push issued tax invoices to FlowAccount OpenAPI, daily cron | `flowaccount_documents/tokens/credentials`, edge fn `flowaccount-sync` | ❌ | Per-tenant FlowAccount credentials; an edge function + queue table |

## D. Collaboration & admin

| Feature | What it does | tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **Team notes** | sticky notes board + floating widget | `notes`, `NotesWidget.jsx` | ❌ | tenant-scoped `notes` table |
| **Announcements** | pinned messages above pages | `announcements`, banner | ❌ | tenant-scoped + a banner in AppShell |
| **Activity log** | audit trail via `log_activity()` RPC | `activity_log` | ❌ | tenant-scoped; wrap key server actions to log |
| **Backup** | DB export/import (JSON/CSV) | `app/api/backup/*` | ❌ | Must be **per-tenant** export (only the caller's tenant rows) + `pms:backup` gate |
| **Property / company settings** | landlord, VAT, bank, logo, name (TH/EN) | `company_settings` | 🟡 partial | HostGate has name/city/currency/timezone; add VAT/bank/logo/landlord for invoices |
| **Staff & roles** | role × app × page r/rw permission matrix | `role_permissions`, RoleMatrix | 🟡 | HostGate has `tenant_members` (owner/admin/staff) but no granular matrix UI |
| **Per-user settings** | theme / language / font | `user_settings` | ✅ | done (theme + locale) |
| **Guided tour** | driver.js per-page walkthrough | `lib/tour/registry.js`, TourButton | ❌ | Nice-to-have; port last |

## E. Channels & guest-facing

| Feature | What it does | tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **Public booking engine** | guest-facing `/book` → pending booking, staff-notify email | `(book)/*`, `lib/book/*`, `notify_web_booking` | ❌ | **Per-tenant**: needs a tenant subdomain or `/book/<slug>` route + per-tenant property/rate reads via service role |
| **Chat (LINE + Messenger + AI)** | omni-channel inbox, AI "TAO" auto-reply/booking, staff assistant, slip vision | `chat_*`, edge fns `line/meta-webhook`,`chat-send`,`chat-ai-respond`,`staff-assistant` | ❌ (big) | Each tenant supplies their own LINE/Meta creds; webhooks must route by channel→tenant; AI keys shared. Biggest channel feature |
| **Email pull** | import OTA bookings from a Gmail inbox | edge fn `pull-bookings-from-email` | ❌ | Per-tenant Gmail OAuth; cron |

## F. POS — Mini Bar (separate sub-app)

| Feature | What it does | tables / files | HostGate | Port notes |
|---|---|---|---|---|
| **POS terminal / products / sales / inventory / dashboard** | mini-bar point of sale | `(pos)/pos/*`, `products`,`categories`,`sales`,`sale_items`,`stock_movements` | ❌ (big) | A whole second app surface; port after the PMS core is complete. tenant+property scoped |

## Already shipped in HostGate v1 (foundation)

✅ Multi-tenant RLS isolation · property codes · error codes (`HG-*`) + log ·
plan limits (multi-property = Pro) · top-bar shell + property switcher ·
liquid light/dark + glass themes (glass currently unlocked for all) ·
**rooms** (floor generator + bulk type assign, shared component) · **guests**
(basic) · **booking calendar** (basic) · **settings** · onboarding that lands
on a ready calendar · TH/EN.

---

## Suggested port order (each phase = its own spec → plan → build)

1. **Phase A — Front-desk depth** (highest daily value): bookings list +
   export, rate plans, calendar power-ups (drag, paste-import, bulk rate),
   guests VIP/blacklist + stay history.
2. **Phase B — Accounting**: invoices + receipts + print + payments, reports,
   then FlowAccount sync.
3. **Phase C — Operations**: housekeeping, maintenance, shifts (decide the
   staff model first).
4. **Phase D — Monthly rentals**: tenants, bills, payments, contracts, meters,
   move-out, co-tenants.
5. **Phase E — Collaboration/admin**: notes, announcements, activity log,
   per-tenant backup, full property/company settings, granular permission
   matrix.
6. **Phase F — Channels**: public booking engine (per-tenant), then chat
   (LINE/Meta + AI), then email pull.
7. **Phase G — POS** (mini bar) + guided tour, last.

### Cross-cutting decisions to make before Phase C/E
- **Staff model:** extend `tenant_members` vs a dedicated `staff` table
  (shifts + housekeeping `completed_by` + invoice `issued_by` all need it).
- **Permissions:** keep the 3 roles (owner/admin/staff) or port the granular
  role×page matrix. Recommend a small `role_permissions` per tenant.
- **Per-tenant secrets** (FlowAccount, LINE/Meta, Gmail): a `tenant_secrets`
  table (RLS service-role-only) is the prerequisite for Phase F + FlowAccount.
- **Premium gating:** decide which ported features are Pro-only (e.g. chat AI,
  channel manager, FlowAccount) vs included.

*This is the survey/prep deliverable. Each phase still gets its own
brainstorm → spec → plan before implementation.*
