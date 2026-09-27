# hotel-pms → HostGate parity audit

Date: 2026-09-16 · Codex · Status: IN PROGRESS — not full feature parity

## Scope and evidence

Owner requests all customer-facing hotel-pms functionality, workflows, appearance and style in HostGate. hotel-pms is strictly read-only. HostGate edits are authorized. Preserve tenant/property isolation and do not copy hotel guests or credentials into HostGate.

- HostGate starting checkout: `1c9755e`, clean before this work.
- hotel-pms HEAD: `a46b264`, matching the production revision recorded in the hand-off. Production revision has NOT been freshly verified against the hosting platform. Existing uncommitted hotel-pms changes were observed and left untouched; comparison uses committed source where relevant.
- `https://hostgate.app/app` in Chrome redirected to `/login`. Authenticated UI comparison is blocked pending login. Requested the hotel's actual production URL and signed-in Chrome sessions through the task input prompt.
- The June 12 inventory is historical, not a current completion checklist. For example, HostGate already implements drag-to-move and paste import despite older notes calling them missing.
- No production database changes, migrations, deployment or outbound messages were performed.

## Decision

Use targeted ports into existing HostGate tenant-scoped modules. A wholesale copy of the single-hotel application would discard SaaS boundaries. Cosmetic changes alone cannot satisfy functional parity. Start with independently verified operational gaps while waiting for authenticated visual inspection.

## First implementation: local only

1. Calendar booking reads now page through all results with stable `check_in,id` ordering and property filtering on each page. Previously one request silently stopped at the PostgREST row cap. Concrete failure: 1,023 overlapping bookings could expose only 1,000, although the database conflict guard still rejected the hidden booking's room.
2. Calendar prerequisite read failures now reach the existing error/retry boundary instead of becoming empty rooms/bookings/rates. Bookings history/export now also rejects a later-page failure rather than presenting a truncated history as complete; it shares the pagination helper and unique tie-breaker.
3. Drag moves now send room/date fields only, preserving negotiated booking amounts and recorded payments. Previously changing room or date overwrote `total_amount` using current rate data, including incomplete window rates. Verified reference: hotel-pms `components/BookingCalendar.jsx` committed drag payload updates room/date (and acknowledges pending INCOMING assignments), not price.
4. Move confirmation now shows both original and proposed date ranges, an amber day-change warning, and bilingual explanation that the agreed amount is unchanged.

The shared paginator uses 500-row requests (below the usual 1,000 cap). It assumes the server cap is at least 500; offset requests do not form a database snapshot across concurrent writes. DB overlap protection remains required. No schema change is needed.

## Feature map — code presence is NOT end-to-end verification

| Area | hotel-pms reference | HostGate evidence / remaining work |
|---|---|---|
| Calendar | committed BookingCalendar + calendar helpers | Grid, day windows, search, rates, paste import, drag, Today panel exist. Pagination and move review corrected locally. Resize, conflict auditor, OTA mix and pending holding-lane acknowledgement require detailed equivalence tests. |
| Bookings | `/bookings` | `/app/bookings` exists with export; failed pagination corrected locally. Compare columns, filters and all export formats. |
| Guests / CRM | `/guests`, guest detail, campaign endpoint | `/app/guests` and detail exist. Compare VIP/blacklist, rollups, campaign operations and consent handling. |
| Rooms / rates | `/property`, `/rate-plans` | `/app/rooms`, `/app/settings`, `/app/rate-plans` exist. Compare every property/company field and rate override behavior. |
| Monthly rentals | rentals, detail, bills, payments, setup, contract editor | HostGate has rentals/detail/bills/payments/setup and contract print. Dedicated contract editor and batch bill printing not present in corresponding route inventory; inspect co-tenants, settlement, meter history and signatures. |
| Housekeeping / shifts / maintenance | three operations pages | Matching HostGate pages exist. Verify checkout-triggered cleaning, assignments, state transitions, realtime and OOS reporting. |
| Hotel supplies inventory | `/inventory` | No corresponding hotel-supplies route; HostGate POS inventory is a different workflow and does not establish parity. |
| Cash drawer | `/cash`, two independent drawers | No corresponding HostGate cash-count route found. POS cash received/change fields are not reconciliation/counting. Requires tenant-scoped schema and a complete count workflow. |
| POS | terminal, products, sales, inventory, dashboard, account, users | Core HostGate POS routes exist. Dedicated POS account/users routes absent; compare permission, void/refund and stock semantics. |
| Invoices / payments | invoice detail and print | Matching routes exist. Verify numbering, tax settings, receipts and payment reconciliation with synthetic HostGate data. |
| In-house accounting | documents, expenses/WHT, GL/VAT, banking, assets | Matching routes and migrations 21–24 exist. Need action-level comparison and full synthetic transactions. No live financial writes performed. |
| FlowAccount | dedicated sync route/integration | No corresponding HostGate route. Historical owner direction favors in-house accounting, but external integration parity is unresolved; do not silently treat it as complete. |
| Rate Watch | `/rate-watch` | No corresponding HostGate route found. Investigate upstream service and tenant credentials. |
| Team notes / announcements / activity | dedicated pages + widgets | HostGate has matching modules; notes page lacks a main grouped-navigation entry. Compare visibility, pinning and notifications. |
| Team permissions | users + role/page matrix | HostGate team route/three membership roles exist. A three-role system does not prove page-level permission equivalence. |
| Backup | export/import API and UI | No matching HostGate backup route found. Export must be tenant-scoped; imports require separate schema/data review. |
| Messaging / TAO | `/messages`, chat widgets, LINE/Meta/AI edge functions | No corresponding customer inbox route found. Requires tenant credential storage, webhook routing, approval/send policy, attachment isolation and provider setup. Do not connect the real hotel's channels to test tenants. |
| OTA email import | email-pull service in reference docs | No demonstrated HostGate equivalent; verify exact current deployment/provider access before port. |
| Guest booking portal | book, login/account, manage, pre-check-in, slip, feedback, loyalty endpoints | HostGate has public room search/checkout/confirmation. Corresponding manage/precheckin/slip/feedback/loyalty routes not found. |
| Channels | hotel-specific STAAH sync | HostGate Channex implementation exists; this is a different integration, not proof of identical workflow/coverage. |
| Appearance / guide | 8 themes, font size, TH/EN, guided tour | HostGate has theme families and TH/EN. Font-size preference is saved but AppLayout reads only theme: visual application not established. Guided tour parity not established. Need authenticated desktop/mobile screenshots. |

## Verification and remaining gate

See final session verification below. Unit tests cover 0/1/499/500/1000/1023/2000 rows, page boundaries, later-page failure, missing data, invalid page sizes, and preservation of zero/negotiated/null amounts and payments during moves.

Before declaring parity or publishing:

1. Receive production hotel-pms URL; sign into both apps in Chrome, using read-only navigation on hotel-pms. Verify actual deployed reference version.
2. Capture module-by-module workflows, field rules, states, screenshots, theme and responsive behavior. Use synthetic fixtures in an isolated HostGate test property for mutation tests.
3. Turn every row above into acceptance criteria, port missing modules preserving tenant/property RLS, and verify two-user isolation for schema changes. Review/apply migrations only at the required approval gate.
4. Compare reference and HostGate screens at matching desktop/mobile sizes, then run full booking → arrival → stay → checkout → housekeeping → invoice/payment and monthly-meter/bill workflows.
5. Review concrete release diff and obtain publishing approval per project instructions. Current changes are not deployed and all-system equivalence remains unverified.

## Final session verification

- `npm test`: **18 passed test files; 253 passed tests** (235 existing + 18 new).
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0, **Compiled successfully**, **Generating static pages (62/62)**. Existing hook-dependency warnings in BookingModal and MaintenanceClient remain; edge-runtime static-generation notice remains.
- `git diff --check`: exit 0.
- `graphify update .`: rebuilt 2,235 nodes / 5,493 edges / 121 communities (ignored generated files).
- Changed confirmation UI has NOT been click-tested or visually verified. No live DB verification; no migration needed for this patch. The production login gate was observed, but no authenticated PMS screen was reached.
