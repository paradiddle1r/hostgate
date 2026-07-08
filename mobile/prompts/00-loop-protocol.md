# Prontera Loop Protocol — HostGate Mobile

You are an engineering agent working the HostGate mobile roadmap. You run in a
loop: one task per iteration, verified before you move on. This file is your
standing instruction; the task files (`01-…` → `06-…`) are your work orders.

## The loop (every iteration)

1. **Pick** the FIRST unchecked `[ ]` item in `mobile/PLAN.md` §3 that is not
   marked 🔒 (🔒 = human-only; skip it and say so in your report).
2. **Read** the matching `mobile/prompts/NN-*.md` work order AND every file it
   tells you to read. Do not skip the reading list — the conventions are not
   optional.
3. **Implement** the smallest complete change that satisfies the acceptance
   criteria. Follow repo conventions (below). Additive migrations only.
4. **Gate** — all three must pass, from the repo root:
   ```
   npx tsc --noEmit
   npm run build
   npx vitest run
   ```
   Red gate = the iteration is NOT done. Fix or revert; never commit red.
5. **Self-review** — reread your diff as a hostile reviewer: tenant-isolation
   holes? hardcoded secrets? theme tokens skipped? missing TH translation?
6. **Record** — check the box in `mobile/PLAN.md`, commit everything:
   `git commit -m "mobile(NN): <what> [loop]"` and push to `main`.
7. **Report** — 3 lines max: what shipped, what's next, anything blocked on 🔒.
8. Repeat until every box is checked or only 🔒 items remain — then STOP and
   list the 🔒 items for the human.

## Hard rules

- **Never weaken tenant isolation.** Every per-tenant table keeps
  `tenant_id IN (SELECT auth_tenant_ids())` for staff. Portal policies ADD
  narrow read paths keyed on `rental_tenants.portal_user_id = auth.uid()` —
  a portal user must never see another tenant's rows or any staff surface.
  Posture reference: `supabase/migrations/20_security_hardening.sql`.
- **SECURITY DEFINER functions self-authorize** (check membership/ownership
  inside), pin `search_path`, and revoke from `anon, public` unless the
  function is deliberately public.
- **Migrations**: idempotent, additive, numbered; drafts live in
  `supabase/migrations/drafts/` until applied, then move them out.
- **App code**: server components + server actions; data layer in `lib/db/*.ts`
  returning `ActionResult<T>` (`ok()/fail()/mapPgError`, `HG-*` codes); UI uses
  Tailwind + `var(--app-*)` tokens only (no hardcoded colors); every string
  bilingual TH/EN via the repo's i18n pattern.
- **No new heavyweight deps** without a note in PLAN.md explaining why.
- **Web must never regress**: the marketing site, PMS (`/app`), and booking
  engine (`/book`) are live for customers. If your change could affect them,
  say how you verified it didn't.

## Repo map (read once, remember)

- PMS app routes: `app/app/**` · marketing: `app/page.tsx` + `components/`
- Auth pages: `app/(auth)/**` (login/signup/verify) — reuse, don't duplicate.
- Data layer: `lib/db/*.ts` · errors: `lib/errors.ts` · plans: `lib/plan.ts`
- Rentals domain (tenant app reads this): `lib/db/rentals.ts`
  (`RentalTenant`, `RentalBill` {rent, electric_amount, water_amount, other,
  total, status draft|issued|paid}, `RentalContract`, `MeterReading`)
- Mobile shells: `mobile/owner/`, `mobile/tenant/` (Capacitor, remote-URL)
- Supabase project: `xwikaqpdulkscdysgxri` (Postgres 17). Secrets via Supabase
  dashboard/vault — never commit keys.
