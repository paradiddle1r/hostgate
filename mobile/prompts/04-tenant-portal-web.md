# Task 04 — Tenant portal web (`/tenant`) — the heart of the Tenant app

## Context
Backend exists after task 03. Build the tenant-facing portal as Next.js routes
under `app/tenant/` in this repo. Mobile-first (it ships wrapped in the tenant
Capacitor shell), but must also work in any browser. Aesthetic: clean + warm,
reuse `var(--app-*)` tokens (light theme default), large touch targets,
bilingual TH-first (tenants are mostly Thai).

## Read first
- `app/app/layout.tsx` (auth/session pattern to mirror — but tenants have NO
  tenant_members row: your layout resolves the caller's `rental_tenants` row
  via `portal_user_id` instead of `getActiveProperty()`).
- `lib/db/rentals.ts` shapes · migration 21 (what a portal user may read).
- `app/(auth)/login` — reuse via `?next=/tenant` redirect, don't fork auth.

## Steps
1. **04a** Shell: `app/tenant/layout.tsx` — session required (redirect to
   login with `next=/tenant`); if signed in but unlinked → `/tenant/link`
   (invite-code screen calling RPC `tenant_portal_link`, friendly errors).
   Data layer `lib/db/tenant-portal-client.ts` (portal side): `getMyRental()`
   (rental_tenant + booking room/property join), `listMyBills()`,
   `getMyContract()`, `listMyMeters()`, `listMyPayments()` — all through the
   portal RLS paths, ActionResult pattern. Bottom tab nav (Home/Bills/Room/
   More), sticky, thumb-reach.
2. **04b** Dashboard `/tenant`: greeting + room number/property, current-month
   bill card (status chip: รอชำระ/ชำระแล้ว), unpaid-bill banner, latest
   announcement, quick actions (จ่ายบิล / แจ้งซ่อม).
3. **04c** Bills: `/tenant/bills` list (month, total, status) →
   `/tenant/bills/[id]` detail: line breakdown (ค่าเช่า/ค่าไฟ+หน่วย/ค่าน้ำ+หน่วย/
   อื่นๆ/รวม), **PromptPay QR** — implement `lib/promptpay.ts` (EMVCo TLV +
   CRC-16/CCITT-FALSE payload from `properties.promptpay_id` + amount; pure
   function + vitest golden-vector tests) rendered with the `qrcode` package
   (add dep, note in PLAN) — then slip upload: `<input type="file"
   accept="image/*" capture="environment">` → compress client-side (canvas,
   max 1600px) → upload to `tenant-slips/<rental_tenant_id>/<uuid>.jpg` → RPC
   `tenant_submit_payment`. Show submission status timeline (ส่งสลิปแล้ว →
   ยืนยันแล้ว ✓ / ถูกปฏิเสธ + note).
4. **04d** `/tenant/room`: contract summary (dates, rent, deposit) + meter
   history (last 12 readings, simple table) + announcements list.
5. **04e** `/tenant/repairs`: create (title/detail/photo optional) → inserts
   `maintenance_orders` with `source='tenant'`, `created_by=auth.uid()` (add a
   narrow portal INSERT policy or RPC — RPC preferred, self-authorizing on the
   linked rental's property) + list own requests with status chips.

## Acceptance
- [ ] Unlinked user → link screen; bad code → friendly error; good code → in.
- [ ] Bills render true breakdown from seeded data; QR scans in a Thai bank
      app to the right account+amount (if no human device: unit tests pass on
      published EMVCo golden vectors AND paste the payload string in report 🔒).
- [ ] Slip upload lands in the bucket path; pending payment appears in the
      owner queue (03c) end-to-end.
- [ ] A portal user nav-guessing PMS URLs (`/app/*`) is redirected away.
- [ ] Every screen bilingual, mobile-viewport clean (390px), gates green.

## Out of scope
Native wrapping (05), push registration on the portal (02c pattern, done when
both land), card-gateway payments.
