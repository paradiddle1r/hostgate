# HostGate production booking performance — 2026-09-17

## Result

Slowness reproduced on `https://hostgate.app` in signed-in Chrome, property `mmm / MMM-01` (15 rooms). This is a small-data real-production sample, not a load test. hotel-pms was not touched.

## Measurements

Chrome CDP `Network.requestWillBeSent` → `Network.responseReceived` measures response headers, NOT the complete streamed response or visible-render completion. Tool execution/wait time is excluded. One measured save per scenario; these are samples, not averages or p95.

| Scenario | POST response headers | Result |
|---|---:|---|
| Direct daily, room101 | 4.111s | Created |
| Walk-in daily, room102 | 5.729s | Created |
| Agoda pending, room103 | 4.092s | Created |
| Blocked room104 | 3.786s | Created, BLOCKED bar observed |
| OOS/aircon room105 | 3.836s | Created, OOS bar observed |
| Booking.com group, rooms201–203 | 4.061s | Three bars observed |
| Booking later used for monthly, room204 | 3.005s | Created |
| Attach monthly config, rent6000/no deposit | 2.764s | Tenant detail opened |
| Extend room204 to 30 nights | 1.004s | Sep17→Oct17 confirmed in booking history |
| Paste Agoda text, room205 | 4.576s | Two-night booking created |

Every measured calendar POST was followed by another calendar GET (headers roughly 0.33–0.64s, but headers underestimate streamed rendering time).

Chrome Resource Timing additionally verified complete responses:

- Paste booking POST: start109485.8ms, responseStart114059.8ms, responseEnd117748.8ms → **8.263s total**. Follow-up GET start114072ms → end117640.9ms (**3.569s**) overlaps the POST; do not add these durations together.
- Monthly config POST: start28385ms → end32654.4ms (**4.269s**). Detail requests start31159.6ms/end34207.1ms and start31524ms/end35463.3ms; last data completion is **7.078s** after the save request started. This is data arrival, not an instrumented paint metric.
- Edit to 30 nights POST: start32387.8ms → end36518.3ms (**4.131s**); follow-up calendar GET start33402.5ms → end37675.8ms (**4.273s**). Last data arrival **5.288s** after POST start.

Open-form timings were contaminated by automation scheduling; no reliable UI paint percentile is claimed. Some CDP/locator timeouts occurred, so a tool timeout by itself was never interpreted as save failure. Each mutation was checked against rendered output before retrying or moving on.

## Verified cause and local mitigation

VERIFIED in code: `BookingModal.save()` and `quickStatus()` call `router.refresh()` after their successful server actions. Those actions already call `revalidatePath('/app/calendar')`. Browser traces confirm the additional GET after each POST. Removed the two client refresh calls locally, retaining server invalidation and all tenant/auth/DB checks. Not deployed; production after-change timing is NOT measured.

VERIFIED: active-property resolution performs sequential auth→membership→property→tenant reads; calendar also reads rooms/types/bookings/plans/memberships then rates and plan dates. Multi-room writes use a serial loop. These are profiling targets, not proven duration attribution: no server tracing was available. Hosting/database region mismatch, cold starts and RLS/query costs remain unverified. Do not label any one of these as the root cause without timing evidence.

Rejected alternatives: removing authentication/RLS or trusting incomplete cached inventory would compromise correctness; wholesale optimistic UI rewrites are larger than necessary before measuring the redundant request fix.

## Functional findings while testing

- Monthly creation attaches configuration to an existing booking. The picker also offered BLOCKED/OOS bookings. After attaching the test config, booking history still displayed type **รายวัน**, even after a verified 30-night date update. Monthly configuration save is tested; a complete correct `booking_type=monthly` or open-ended workflow is NOT established.
- Paste preview recognized guest, dates, Agoda and reservation number. The booking form kept name/dates but lost the OTA/reference fields; filled these back manually before saving. Code `CalendarClient.onSeed` forwards only checkIn/checkOut/guestName/phone.
- Manual total1000 was saved, while the bottom form price preview showed THB0 because the property lacks configured base rates. Distinguish computed-rate preview from entered total.
- Block/OOS rows display a dash for status and behave differently under the bookings-list status filter. Do not rely on that list alone for block cleanup confirmation; calendar disappearance and restored availability were checked.

## Cleanup / retained evidence

Created **10 booking rows**, codes `BK-MMM-01-0002` through `BK-MMM-01-0011`, all in MMM-01, with names/references prefixed `HGTEST-0917` or issue notes containing that marker:

- 0002 Direct101, 0003 Walk-in102, 0004 Agoda103
- 0005 BLOCKED104, 0006 OOS105
- 0007/0008/0009 group201/202/203
- 0010 monthly-config candidate204, 0011 paste205

Cancelled each through the UI; did not permanently delete records. Eight guest booking rows visibly show cancelled in history; both operational bars disappeared after their cancellation actions. Final calendar: **0 test bars, 0 bookings, THB0, 15/15 available**. Rentals: **0 active tenants, THB0 monthly rent, 15 available rooms**. The monthly configuration linked to cancelled0010 remains as test history, as do audit/cancelled booking records. No invoices, contracts, bills, meter readings, money transfers or real guest contacts were created. Existing historic booking0001 left unchanged.

## Coverage limits and next steps

Tested main staff workflows: direct, walk-in, manually entered OTA, multi-room, block, OOS, monthly configuration, 30-night edit, paste import, cancellation. Did not test every Cartesian combination of status/payment/OTA, inbound Channex/webhook, actual guest public checkout, open-ended monthly lease, co-tenant creation, or concurrent load. These are not declared complete; provider/guest workflows need separate scoped fixtures and monthly-type behavior needs fixing first.

1. Browser-QA the local no-extra-refresh change and verify one POST with no redundant GET while the saved row appears.
2. Obtain publishing approval per project instructions, deploy, then repeat the exact production scenarios and compare full response/paint timing.
3. If still slow, add server timings for active-property resolution, DB write, and calendar reread; verify deployment region versus Supabase Singapore before changing infrastructure.
4. Fix monthly conversion and paste field propagation separately with regressions.

## Verification of local code change

`npm test`: **18 test files / 253 tests passed**. `npx tsc --noEmit`: exit0. `npm run build`: exit0, **Compiled successfully**, **Generating static pages (62/62)**. Existing hook-dependency warnings remain. `git diff --check`: exit0. Graphify refreshed. No new schema, deployment or production-code change. Existing Sep16 parity edits preserved.
