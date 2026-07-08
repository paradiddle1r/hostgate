# HostGate Mobile — Master Plan

> **Read me first.** This file is the single source of truth for shipping the two
> HostGate mobile apps to Google Play + Apple App Store. The Prontera
> engineering loop (see `mobile/prompts/00-loop-protocol.md`) works this file's
> checklist top-to-bottom until every box is checked.

Two apps, one codebase strategy:

| | **HostGate Owner** | **HostGate Tenant** |
|---|---|---|
| Audience | Property owners / staff (existing PMS users) | Monthly tenants of those properties |
| Does | Everything the web PMS does — calendar, bookings, rentals, POS, reports | View bills & room charges, pay (PromptPay QR + slip), contract, meter history, repair requests, announcements |
| Web surface | `hostgate.app/app` (EXISTS — the PMS) | `hostgate.app/tenant` (NEW — to be built, task 04) |
| Shell | Capacitor remote-URL wrapper (`mobile/owner/`) | Capacitor remote-URL wrapper (`mobile/tenant/`) |
| App ID | `app.hostgate.owner` | `app.hostgate.tenant` |
| Push | New booking, new payment-slip submitted | Bill issued, payment verified, repair status |

## 1. Architecture (decided — do not relitigate in the loop)

1. **Capacitor remote-URL shells.** Both apps are thin native wrappers that load
   the live site. The PMS already works responsively; every web deploy updates
   both apps instantly with no store re-review. Native layers added on top:
   push notifications (the reason wrappers alone aren't enough) and camera
   (slip capture). We deliberately did NOT choose Expo/React Native — it would
   fork the UI from the battle-tested Next.js app and triple maintenance.
2. **One Firebase project, FCM v1 for BOTH platforms.** Upload the APNs auth
   key into Firebase so a single FCM send covers Android + iOS. No direct APNs
   integration.
3. **Push pipeline** (task 02):
   `Capacitor @capacitor/push-notifications` → token → RPC
   `register_device_token()` → `public.device_tokens` → Postgres trigger on the
   watched tables inserts into `public.push_queue` → edge function `push-fanout`
   (invoked by pg_cron every minute AND best-effort pg_net fire-and-forget from
   the trigger) reads the queue, resolves recipient tokens, POSTs FCM v1,
   marks sent/failed. Secrets: `FCM_SERVICE_ACCOUNT_JSON` in Supabase.
4. **Tenant identity = invite-code linking** (task 03). Owners already manage
   `rental_tenants` rows. Add `portal_user_id uuid` + `portal_invite_code text`
   to `rental_tenants`. Owner shares the code; tenant signs up with the normal
   Supabase email auth in the tenant app, enters the code once; RPC
   `tenant_portal_link(code)` binds `portal_user_id = auth.uid()`. All tenant
   RLS keys off `portal_user_id = auth.uid()`. A tenant user has NO
   `tenant_members` row — they are not staff and must never see PMS data.
5. **Payments phase 1 = PromptPay + slip verify.** Property gets a
   `promptpay_id` column; the portal renders a PromptPay QR (EMVCo payload
   generated client-side — no gateway) for the bill total; tenant uploads a
   transfer slip photo → `rental_payments` row (status `pending`) + private
   storage bucket `tenant-slips`; owner verifies in the web PMS which flips the
   bill to `paid`. Card gateways (Stripe/Omise) are explicitly **out of scope**
   for v1 — revisit after launch.
6. **Apple 4.2 (minimal functionality) risk, eyes open.** Mitigations baked in:
   native push, camera slip capture, app icon/splash, remembered session. If
   App Review still balks at the owner app, fallback is unlisted/TestFlight
   distribution (owners are a closed audience); the tenant app has stronger
   native justification (payments + camera + push) and ships publicly.

## 2. Repo layout

```
mobile/
  PLAN.md                ← this file (loop source of truth)
  README.md              ← quickstart for humans
  owner/                 ← Capacitor shell: HostGate Owner
  tenant/                ← Capacitor shell: HostGate Tenant
  prompts/               ← Prontera loop prompts, one per task below
supabase/migrations/drafts/
  21_tenant_portal_DRAFT.sql      ← task 03 (review → apply → move out of drafts/)
  22_device_tokens_push_DRAFT.sql ← task 02 (same)
app/tenant/              ← (task 04 creates this) tenant portal web routes
```

Conventions the loop MUST follow (same as the rest of HostGate):
- Server components + server actions; data layer in `lib/db/*.ts` returning
  `ActionResult<T>` with `HG-*` error codes via `mapPgError`.
- RLS everywhere; migrations additive + idempotent; NEVER weaken
  `tenant_id IN (SELECT auth_tenant_ids())` policies (see
  `supabase/migrations/20_security_hardening.sql` for the posture).
- UI: Tailwind + `var(--app-*)` theme tokens, bilingual TH/EN via `lib/i18n`.
- Gates before every commit: `npx tsc --noEmit` ✚ `npm run build` ✚
  `npx vitest run` — all green or the iteration is not done.

## 3. Task checklist (the loop works this list; 🔒 = needs the human)

### Phase A — Owner app
- [ ] **01a** Owner shell boots: `cd mobile/owner && npm i && npx cap add android`
      loads hostgate.app, login works, session persists across relaunch.
- [ ] 🔒 **01b** Human: install Xcode → `npx cap add ios`; create Firebase
      project `hostgate-mobile`, download `google-services.json` +
      `GoogleService-Info.plist` into the shells; Apple Developer ($99/y) +
      Play Console ($25) accounts.
- [ ] **01c** App icon + splash from `resources/` (use `@capacitor/assets`),
      deep-link `hostgate://` scheme + universal links for auth callback.
### Phase B — Push
- [ ] **02a** Apply migration 22 (device_tokens + push_queue + triggers) after
      review; move file out of `drafts/`.
- [ ] **02b** Edge function `push-fanout` (FCM v1, service-account JWT) + pg_cron
      drain; unit-test payload builder.
- [ ] **02c** Web: register token on login when running inside Capacitor
      (`Capacitor.isNativePlatform()`), un-register on logout.
- [ ] **02d** Wire events: `bookings` INSERT → owners of that property;
      `rental_payments` INSERT → owners; `rental_bills` status→issued → that
      bill's tenant; `rental_payments` status→verified → that tenant.
### Phase C — Tenant backend
- [ ] **03a** Apply migration 21 (portal columns, rental_payments,
      tenant-slips bucket, RLS, RPCs) after review; move out of `drafts/`.
- [ ] **03b** Owner web UI: "Tenant portal" card on the rental detail page —
      shows/regenerates invite code, link status, unlink button.
- [ ] **03c** Owner web UI: pending payment-slip review queue (verify/reject →
      flips `rental_bills.status`), badge in nav.
### Phase D — Tenant portal (web)
- [ ] **04a** `app/tenant/` shell: login/signup (reuse existing auth pages via
      redirect), invite-code linking screen, mobile-first layout, TH/EN.
- [ ] **04b** Dashboard: current room, this-month bill card, unpaid banner.
- [ ] **04c** Bills: list + detail (rent/electric/water/other breakdown),
      PromptPay QR (EMVCo payload lib in `lib/promptpay.ts` + unit tests),
      slip upload (camera capture) → `rental_payments`.
- [ ] **04d** Contract view + meter-reading history + announcements read-only.
- [ ] **04e** Repair request: create + track status (reuses
      `maintenance_orders` with `source='tenant'` column added in mig 21).
### Phase E — Tenant shell & release
- [ ] **05a** Tenant shell (`mobile/tenant/`) boots against `/tenant`, camera
      permission strings, push registration.
- [ ] 🔒 **06a** Human: store listings (screenshots, descriptions TH/EN,
      privacy policy URL — reuse hostgate.app/privacy), App Store privacy
      nutrition labels, Play data-safety form.
- [ ] **06b** Build & upload: `.aab` via Android Studio / `.ipa` via Xcode →
      internal testing tracks → production.

## 4. Definition of done (whole project)
Owner + Tenant apps installable from both stores; a new booking pings the
owner's phone in <60s; a tenant can see an issued bill, scan its PromptPay QR,
upload a slip from the camera, and the owner can verify it from the web PMS —
with zero regressions to the existing web product (all gates green on every
commit).
