# Booking fixes — 2026-09-18

Status: LOCAL ONLY; migration 28 and publishing await owner approval. hotel-pms was not modified. Preserves the Sep16 pagination/drag changes and Sep17 duplicate-refresh removal.

## Changes

- Active-property resolution shares one request-scoped membership+tenant read with layout/navigation. Removes the extra tenant lookup and separate membership query; does not cache authorization across requests. Membership failures no longer appear as empty tenant lists.
- Calendar reads prices and plan stripes together, concurrently with rooms/bookings/plans, instead of two sequential daily_rates queries after loading room types. Reads all pages with stable ordering and property/date scope; rejects partial failures.
- Paste callback now forwards OTA and reservation number into BookingModal. Saving selected OTA/Walk-in/Direct booking also sets the corresponding source instead of always defaulting to direct.
- Total preview uses the entered amount, including manual overrides, multiplied by selected room count. Extra-bed charge remains its existing separate field.
- Monthly candidates exclude blocked/OOS/cancelled/checked-out bookings. Required read errors fail closed.
- Migration `28_rental_booking_type.sql` converts the linked booking to monthly in the same transaction as rental configuration. Uses a row lock and SECURITY INVOKER; validates tenant+property, disallows operational inventory and new terminal bookings. Existing monthly configurations remain editable after checkout. No historical backfill. A later rental write failure rolls conversion back.
- Successful rental configuration invalidates calendar/history as well as rentals.

## Observed validation

- `npm test`: **21 files / 271 tests passed**. Includes 10 actual PostgreSQL/PGlite migration cases (two tenant identities with RLS, same-tenant wrong property, failed-write rollback, repeat upsert, terminal/operational rejection, post-checkout bookkeeping, idempotent migration, no backfill); 5 request-context/query tests; 3 complete calendar rate-read tests.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, 62/62 static pages. Existing hook warnings in BookingModal and MaintenanceClient remain.
- `git diff --check`: clean.
- Browser QA on 127.0.0.1:4178, importing actual CalendarClient/BookingModal/PasteImportModal with **synthetic action and navigation adapters** (no DB/network writes): pasted Agoda + HGQA-0918 + two dates + guest; selected room101 and manual amount750; footer showed THB750 and submitted payload retained ota/reference/750/source=ota. Created blocked102 and OOS-aircon103; all three bars appeared. Reopened booking retained750; check-in submitted checked_in. Instrumented router.refresh count stayed0; browser error log empty.
- The synthetic adapter supplies refreshed props. This verifies client payload/rendering and absence of duplicate refresh calls, **not Next server-action/RSC delivery or production latency**. Production before/after timing remains mandatory after release. PGlite uses a minimal schema/RLS fixture, not the entire production schema.

## Rollout after approval

1. Confirm HostGate Supabase project is `xwikaqpdulkscdysgxri` and inspect existing booking triggers/RLS for compatibility; do not use hotel-pms project.
2. Apply only migration28 through authorized DB tooling; run database advisors. No backfill or cleanup of historical bookings.
3. Publish reviewed app changes, retaining Sep16/17 fixes. No deployment performed in this session.
4. Repeat synthetic direct/walk-in/OTA/group/block/OOS/monthly/paste flows in MMM-01 with unique identifiers. Verify saved rows/booking_type/source and calendar after each action; measure request headers, full response, subsequent GETs, and actual visible availability separately. Compare Sep17 baseline, not local fixture timings.
5. Cancel only newly created test bookings through normal UI and verify available rooms restored. Do not delete audit/history rows or issue payments/invoices.

Rollback: redeploy prior app if needed. If migration incompatibility is observed, remove only `rental_tenants_booking_type` trigger through an approved follow-up migration. Do not blindly revert monthly booking types already legitimately converted.

## Remaining scope

No production speed improvement is claimed yet. Full hotel-pms feature/style parity, open-ended monthly creation, and atomic multi-room/co-tenant creation are outside this fix set. Existing legacy monthly configs on daily bookings are converted on a valid subsequent save, not bulk changed. Monthly candidate history still uses the existing 500-row reader and needs a dedicated scoped query in a future completeness pass.
