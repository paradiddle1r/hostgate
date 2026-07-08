# Task 02 — Push notifications (FCM v1, both apps)

## Context
DB draft ready: `supabase/migrations/drafts/22_device_tokens_push_DRAFT.sql`
(device_tokens + push_queue + enqueue triggers for booking_created /
payment_submitted / bill_issued / payment_verified). Your job: apply it, build
the fanout, and register tokens from the web app when it runs inside Capacitor.
🔒 prerequisite: Firebase project + `FCM_SERVICE_ACCOUNT_JSON` secret set in
Supabase (ask the human if missing — check `supabase secrets list`).

## Read first
- The draft migration end-to-end · `mobile/PLAN.md` §1.3
- `supabase/migrations/20_security_hardening.sql` (definer-function posture)
- An existing edge function for house style if any exist in `supabase/functions/`.

## Steps
1. **02a** Review the draft critically (recipient resolution, RLS, idempotency),
   fix anything you disagree with, apply it, move the file to
   `supabase/migrations/22_device_tokens_push.sql`.
2. **02b** Edge function `supabase/functions/push-fanout/index.ts`:
   - Auth: require service-role bearer (constant-time compare).
   - Drain: select unsent `push_queue` rows (limit 100, oldest first).
   - Resolve recipients: `user_id` set → that user's `device_tokens` filtered
     by `audience`; null + audience='owner' → all `tenant_members` of
     `tenant_id` joined to their tokens.
   - Send FCM v1 (`https://fcm.googleapis.com/v1/projects/<id>/messages:send`)
     with an OAuth2 JWT minted from `FCM_SERVICE_ACCOUNT_JSON` (google-auth via
     `jose` — no heavyweight SDK). `notification` + `data` payload (deep link).
   - 404/410 token → delete that device_tokens row. Stamp `sent_at`/`error`.
   - Extract the payload builder into a pure function + vitest unit tests
     (`lib/push/build-fcm-payload.ts` so it's testable from the repo root).
3. **02c** Web-side registration, in the PMS shell (`components/app/AppShell.tsx`
   mount) and later the tenant portal layout: dynamic-import a small
   `lib/native/push.ts` that no-ops unless `Capacitor.isNativePlatform()`;
   on login → `PushNotifications.requestPermissions()` + `register()` →
   RPC `register_device_token(token, platform, audience)`; on logout →
   `unregister_device_token`. `@capacitor/core` becomes a root devDependency
   (tiny, tree-shaken out of web bundles via the dynamic import — verify with
   the build output sizes).
4. **02d** Schedule the pg_cron drain (see the commented block at the bottom of
   the migration) once the function is deployed; verify end-to-end by inserting
   a test bookings row and watching push_queue → sent_at.

## Acceptance
- [ ] Migration applied + moved out of drafts; advisors show no new findings.
- [ ] `push-fanout` deployed; queue rows get `sent_at` within a minute.
- [ ] Payload builder unit-tested (≥4 cases incl. token cleanup + deep link).
- [ ] Web register/unregister proven no-op in normal browsers (bundle diff ≈ 0).
- [ ] A real device (or the human) receives "New booking" — if no device is
      available, show the FCM API 200 response in your report and flag 🔒.

## Out of scope
Notification preference UI, quiet hours, per-event opt-outs (post-launch).
