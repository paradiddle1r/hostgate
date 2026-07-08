# Task 03 — Tenant portal backend + owner-side UI

## Context
Draft ready: `supabase/migrations/drafts/21_tenant_portal_DRAFT.sql` — portal
columns on `rental_tenants` (invite-code linking), `properties.promptpay_id`,
`rental_payments` (slip submissions pending→verified/rejected), portal RLS,
RPCs `tenant_portal_link` / `tenant_submit_payment`, private `tenant-slips`
bucket. This task applies it and builds the OWNER-side management UI in the
existing PMS.

## Read first
- The draft migration end-to-end — adversarially. Especially: can a linked
  portal user reach ANY row not theirs? Can an unlinked user do anything?
- `lib/db/rentals.ts` (RentalTenant/RentalBill shapes) ·
  `components/app/rentals/TenantDetailClient.tsx` (where 03b lands)
- `mobile/prompts/00-loop-protocol.md` hard rules.

## Steps
1. **03a** Review → fix → apply migration 21 → move out of `drafts/`.
   Then RLS-verify with SQL role simulation (document the queries in your
   report): (a) a portal user sees only their own rental_tenant/bills/
   contract/meters/payments; (b) they CANNOT see bookings/guests/invoices or
   any other tenant's rows; (c) staff flows unchanged.
2. Data layer `lib/db/tenant-portal.ts` (staff side): `getPortalStatus`,
   `generateInviteCode` (8-char unambiguous A-Z0-9, unique), `unlinkPortal`,
   `listPendingPayments(propertyId)`, `reviewPayment(id, 'verified'|'rejected',
   note?)` — verified also flips the bill to `paid` (single RPC or transaction
   so they can't diverge; add RPC to migration if needed).
3. **03b** "Tenant portal" card on the rental detail page: link status
   (linked ✓ + date / not linked), invite code with copy button +
   regenerate + unlink (confirm dialog). Bilingual, theme tokens.
4. **03c** Payment review queue: new section or page under rentals —
   pending slips list (tenant, room, bill period, amount, slip image via
   signed URL, note) with Verify / Reject actions; nav badge with pending
   count. `properties.promptpay_id` gets an input on the property settings
   page (with a one-line explainer of what it's for).

## Acceptance
- [ ] Migration applied + moved; role-simulation results pasted in report.
- [ ] Owner can generate/copy/regenerate/unlink an invite code on a rental.
- [ ] Owner can verify a (SQL-seeded) pending payment → bill flips to paid;
      reject leaves the bill issued.
- [ ] promptpay_id editable in property settings.
- [ ] Gates green; no new security-advisor findings.

## Out of scope
The tenant-facing portal itself (04), push on these events (02d covers it).
