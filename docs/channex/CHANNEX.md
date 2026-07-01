# Channex.io — HostGate integration reference

Condensed from the full docs sweep of https://docs.channex.io/ (2026-07-02).
This file is the always-offline reference for anyone touching `lib/channex/`.

## Environments & auth

| | Staging | Production |
|---|---|---|
| Base URL | `https://staging.channex.io` | `https://app.channex.io` |
| PCI endpoint | `secure-staging.channex.io` | `secure.channex.io` (whitelisted PCI partners only) |
| Cost | free, full-featured | partner agreement (billed per connected property) |

- Auth header on every call: `user-api-key: <key>` — keys are created in the
  Channex UI (Organization → API Keys), **shown once**, account-wide by default
  (can be scoped to selected properties).
- Responses are JSON:API-ish: `{ data: {id, type, attributes}, meta }`;
  errors: `{ errors: { code, title, details } }`.
- Pagination `?pagination[page]=N&pagination[limit]=100` (max 100), meta.total.
- Filtering `filter[field]=value`, ordering `order[field]=asc`.

## Entity model & onboarding order

Group → **Property** (title+currency minimum; full address before first
channel) → **Room Types** → **Rate Plans** → push **ARI** → receive
**bookings**. Currency is set at property level and is effectively immutable.

Key create-required fields:
- Room type: `property_id, title, count_of_rooms, occ_adults, occ_children,
  occ_infants, default_occupancy` — availability starts at **0** until pushed.
- Rate plan: `title, property_id, room_type_id, options[{occupancy,
  is_primary, rate}]` — rate starts at 0, min_stay 1; push real values via ARI.
  `sell_mode` per_room|per_person; derived/cascade rate modes exist.

## ARI (availability / rates / restrictions)

- `POST /api/v1/availability` — `{values:[{property_id, room_type_id,
  date_from, date_to, availability}]}`
- `POST /api/v1/restrictions` — `{values:[{property_id, rate_plan_id,
  date|date_from+date_to, days?, rate|rates[], stop_sell, closed_to_arrival,
  closed_to_departure, min_stay_arrival, min_stay_through, max_stay}]}`
- Batch N changes into ONE call. Rate > 0, no past dates, body < 10 MB,
  ~**20 ARI requests/min per property** (429 → backoff + queue).
- Full sync must handle **500 days in a single call** (cert test 1); Channex
  applies async (returns a task id). Deltas only day-to-day; full sync ≤ 1/24h.
- Our implementation: `channex_ari_queue` + run-length-encoded spans +
  `flushQueue()` = ≤1 availability call + ≤1 restrictions call per flush.

## Bookings (the certified pattern)

1. Webhook `booking` events = **ping only** (no HMAC, out-of-order, may drop).
2. Source of truth: `GET /api/v1/booking_revisions/feed` (unacked revisions).
3. Persist → apply → `POST /api/v1/booking_revisions/:id/ack` — **every
   revision must be acked** (unacked → redelivery + `non_acked_booking` after
   30 min).
4. Statuses `new | modified | cancelled` — same booking_id arrives again as a
   new revision; upsert by booking_id.
5. Payload: `unique_id` (e.g. BDC-…), arrival/departure, amount, currency,
   ota_commission, customer{}, guarantee{} (card, masked unless PCI),
   rooms[] (each with **nullable** room_type_id/rate_plan_id — handle
   unmapped!), per-night `days{}` breakdown, occupancy, services, taxes.
6. **Availability zeroing**: when a booking lands, WE must push the updated
   availability (Channex doesn't manage master availability).
7. `GET /bookings` is for backfill/reconciliation only — certification
   requires consuming revisions.
8. Booking.com reporting: `POST /bookings/:id/no_show | invalid_card |
   cancel_due_invalid_card`.

## Webhooks

- CRUD at `/api/v1/webhooks`; create body: `{webhook:{property_id,
  callback_url, event_mask, headers{}, is_active, send_data}}`.
- Event mask: `booking;booking_unmapped_room;booking_unmapped_rate;
  sync_error;non_acked_booking` (see docs for the full list incl. Airbnb
  reservation_request/alteration_request, reviews, channel lifecycle).
- **No signing** — we register a custom header `x-hostgate-secret` and verify
  it in `/api/channex/webhook`; payloads are never trusted (re-fetch via feed).
- Retries: 5xx → exponential backoff, 10 attempts over ~24h. Answer 200 fast.

## Channel mapping (iframe)

Channel↔room/rate mapping happens in Channex's UI, embedded white-label:
1. `POST /api/v1/auth/one_time_token` `{property_id, username}` → token (15-min TTL).
2. Iframe `{base}/auth/exchange?oauth_session_key=TOKEN&app_mode=headless&redirect_to=/channels&property_id=...&lng=en`.
   Extra params: `channels=BDC,ABB` (restrict OTAs), `read_only_availability=true`.
   Also `/messages` for OTA guest messaging.

## Cards / PCI (later phase)

| Option | Requirement | How |
|---|---|---|
| Full PANs | SAQ D Service Provider AOC (<12 mo) | secure.channex.io + IP whitelist via support@channex.io |
| Token vault | provider's AOC (PCI Booking / PCI Proxy / Vaultera) | same |
| Stripe tokenization | none | install app `stripe_tokenization`; `POST /bookings/:id/stripe_token` |
| Payment App | none | OAuth property's Stripe; pre_auth/settle/void/charge/refund endpoints |
| Human-only | none | free PCI App: "View Card" + email 2FA in Channex UI |

## Certification (summary — see ONBOARDING.md for the runbook)

- Self-signup staging → build → standard test property ("Test Property -
  (HostGate)", USD, Twin+Double, 4 rate plans) → run the 14 scenarios → submit
  task IDs via https://forms.gle/xA8F3eSYBPBd8apYA → live screenshare.
- Auto-fail: per-date loops instead of batching, timer-based full syncs,
  cert-only scripts/hardcoded values, missing acks.
- Contact: support@channex.io. Partner must own a real PMS (we do).
