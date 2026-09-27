# Create/move latency — 2026-09-27

## Production evidence (read-only)

`vercel inspect https://hostgate.app` returned production READY deployment
`dpl_EKPtXkJwZBQKPTbMXdZ79kHyVp6C`, created 2026-08-05 17:27 +07,
URL `hostgate-8f49ujok9-paradiddle1rs-projects.vercel.app`, functions in `iad1`.
Thus Sep16–18 local fixes have NOT reached production. HostGate DB is in
Singapore per project configuration/CLAUDE.md. Cross-region queries add network
latency; the exact fraction of the observed delay is not measured this session.

## Local implementation

- Vercel region configured as `sin1`, alongside the database. Actual region must
  be confirmed on the next deployed build.
- Calendar create/update/status use same-origin POST `/api/calendar/bookings`.
  Auth, active-property scoping, explicit editable-field validation, and existing
  RLS/conflict triggers remain. Rooms are resolved against the active property;
  room types and ownership cannot be supplied by the browser.
- Returns committed booking rows as JSON, without waiting for a calendar RSC
  render in the write response. Client merges them immediately. One background
  router refresh reconciles inventory/cache after the response; it is not part
  of save completion. This moves rendering off the critical path rather than
  claiming to eliminate all refresh traffic.
- Group bookings use one INSERT statement, returning all rows. A conflict rolls
  the entire group back. Existing other server-action consumers unchanged.
- Drag remains optimistic, locks another drag on the same pending row, and
  restores its original row immediately on failure instead of waiting for a
  slow refresh. Incoming props preserve currently pending move rows.
- Active-property resolution no longer redundantly authenticates before its
  membership reader (important outside React's request cache in route handlers).
- Quick status buttons disabled while modal save is pending. Interrupted writes
  are never auto-retried; UI asks the operator to reload/check before retrying.

## Verification

- `npm test`: **25 files, 298 tests passed**. Includes route origin/auth/active
  property guards, group single-call semantics, parser ownership rejection,
  interrupted-write no-retry handling, and actual PGlite execution of the
  repository's booking code/conflict triggers. Two-room insert produced distinct
  BK-QA-0001/0002; a subsequent conflicting two-room insert left neither new row.
- `npm run typecheck`: exit0; `npm run build`: exit0, 62/62 pages plus new API.
  Existing BookingModal/MaintenanceClient hook warnings remain.
- Browser: actual CalendarClient/BookingModal/calendar-api against a local
  synthetic HTTP backend + navigation adapter. Created Agoda booking750 in101,
  dragged/confirmed101→102, reopened confirmed102 and unchanged750, simulated
  HG-BOOK-409 update failure retained form and old booking, group creation
  displayed both101 and103. Error console empty. Background refresh counted
  once per success (3), never on rejected modal save.
- Screenshot: `output/playwright/booking-fix-qa/2026-09-27-result.png` (ignored).
- `git diff --check` clean; graphify updated.

Browser fixture does not measure production latency or exercise actual Next
RSC reconciliation. No production booking writes, migration, push, or deployment
occurred this session. Speed changes require no NEW schema migration; previously
prepared rental migration28 still independently awaits approval.

## Release and measurement

Publishing still needs approval under the user's supplied AGENTS instructions.
After approval deploy the reviewed app/region configuration; inspect output
region `sin1`. Compare repeated create/move timings with Sep17 baseline (POST
headers3–6s, full response up to8.263s) in the same test property. Record JSON
response completion separately from background refresh and visible bar update.
Verify rejected moves roll back, multi-room conflict writes zero partial rows,
and cancellation of newly created test rows restores availability. Do not
promise a target duration until this production run is observed. Preserve
hotel-pms as read-only. Full parity and rental migration28 remain separate work.

## Production release completed (owner approved “จัดการเลย”)

- Deployed 2026-09-27 via `vercel deploy --prod --yes`; READY
  `dpl_FzsGq5nZHLR6Xzvn22F4Zi3mws5R`,
  `https://hostgate-14vlwvyii-paradiddle1rs-projects.vercel.app`, aliased hostgate.app.
  Subsequent `vercel inspect https://hostgate.app` confirmed function region **sin1**.
  Deployed source recorded in local commit `c3b0193` (same working files uploaded).
- Real authenticated MMM-01 browser tests, each measured with browser Resource
  Timing for complete `/api/calendar/bookings` response (not tool-call time):

  | Operation | Response duration |
  |---|---:|
  | Create Agoda, room101, amount750 | 876.3 ms |
  | Drag/confirm101→102, same dates | 733.2 ms |
  | Group create101+103+104, amount500 each | 369.0 ms |
  | Block105 | 698.5 ms |

- First create's background calendar refresh took591.3ms separately after the
  JSON response. These are individual observations, not p50/p95 or a guarantee.
  Prior Sep17 requests were on a different date/deployment (headers3–6s,
  full paste response8.263s), so the comparison is indicative, not controlled.
- Observed create/move/group/block success; moved booking retained750 and102.
  Full browser reload retained all test bars and group-of-three aggregation.
  This validates production persistence and Next background reconciliation for
  these flows, beyond the earlier synthetic fixture.
- Created five rows, all tagged HGTEST-0927 (SPEED, GROUP×3, BLOCK issue note).
  Cancelled each through UI; full reload showed zero test bars/zero BLOCKED,
  original one five-night booking unchanged, revenueTHB0, availability15/15
  for Sep27–29. Cancelled audit rows retained; no deletion/financial documents.
- Proof screenshots (ignored): `output/playwright/booking-fix-qa/2026-09-27-production.png`
  and `2026-09-27-production-clean.png`. hotel-pms untouched.
- Migration28 was NOT applied; separate monthly-conversion work remains pending.
