# In-house Accounting → HostGate port plan (multi-tenant)

> Authored by Fable (orchestrator), 2026-07-22 overnight. Owner directive: bring the accounting
> system just shipped in `~/Documents/hotel-pms` (commits 446fec4..2765e57, migrations 69-75) to
> HostGate for customers. Implementation agents: read this file, HostGate `CLAUDE.md`, and the
> SOURCE files in `~/Documents/hotel-pms` (`docs/accounting-build-plan.md` = original blueprint,
> `lib/accounting/*`, `schema_update_69..75_*.sql`, `app/(app)/{documents,expenses,accounting,banking,assets}`).

## 0. Non-negotiable guardrails

1. **HostGate DB is LIVE with real customers** — Supabase project `xwikaqpdulkscdysgxri`
   (ap-southeast-1, free tier: pauses when idle; if reads come back empty, check project status
   is ACTIVE_HEALTHY before concluding anything). Additive DDL only. Never touch existing tables
   beyond adding nothing — accounting is fully new tables.
2. **Multi-tenant is the law.** Every new table: `tenant_id uuid not null references tenants(id)`,
   `property_id uuid not null references properties(id)`, RLS enabled with the house pattern
   `tenant_id in (select auth_tenant_ids())` (copy the exact policy style from
   `supabase/migrations/05_pms_tables.sql`; write via the same role/permission conventions the PMS
   tables use — inspect how invoices (08_phase_b) gate writes). All SECURITY DEFINER functions must
   take/derive tenant_id and re-verify membership internally (see how existing RPCs do it).
   Gapless counters are per (tenant_id, doc_type, year). Numbers are per tenant.
3. Migration files: `supabase/migrations/21_accounting_documents.sql`, `22_accounting_gl.sql`,
   `23_accounting_banking_assets.sql`. Apply via MCP `apply_migration` (project `xwikaqpdulkscdysgxri`),
   commit the files.
4. **Per-tenant seeds**: `seed_tenant_accounting(p_tenant uuid, p_property uuid)` SECURITY DEFINER —
   inserts the Thai SME COA (~100 accounts, port from hotel-pms schema_update_71) + posting_account_map
   rows for that tenant, idempotent (ON CONFLICT DO NOTHING). Call it (a) from `provisionTenant()`
   (find it — onboarding server action) for new signups, (b) in migration 22 for ALL existing
   tenant+property pairs. COA is per-tenant so customers can edit their own chart.
5. **No cross-tenant data in backfill.** Auto-posting backfill (invoices/POS since 2026-01-01) must
   iterate per tenant and stamp tenant_id/property_id from the source row. Drafts only.
6. Working tree contains UNCOMMITTED landing/labs changes that are LIVE in production — do not
   touch, revert, or commit them. Commit ONLY your own new/changed files. **Never `git push`, never
   deploy** — the orchestrator deploys via `vercel --prod` from the dirty tree (house precedent).
7. Verify per phase: `npx tsc --noEmit` (or the repo's typecheck script) + `npx vitest run` green.
   Full `npm run build` happens in final integration only.
8. Conventions: **TypeScript strict + Tailwind** (darkMode class). NOT the hotel-pms inline-style JSX.
   Copy component/list/editor patterns from `app/app/invoices/*` and data-access patterns from
   `lib/db/*`. i18n via `lib/app-i18n.ts` (`useAppT()`) — add keys th+en same commit. Icons lucide-react.
   Money `numeric(12,2)`; all money math must round exactly like hotel-pms `lib/accounting/money.js`.
9. Commits: `feat(accounting): HG-P<n> — <summary>` + trailer
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## 1. What to port (source → target)

| hotel-pms source | HostGate target | tenant notes |
|---|---|---|
| schema 69 contacts/sales_documents/items/counters/issue_document_number/recompute | migration 21 | + tenant_id/property_id everywhere; counters per tenant |
| schema 70 expenses/items/wht_certificates/expense-receipts bucket | migration 21 | storage path prefix `tenant_id/…`; bucket `expense-receipts` with tenant-scoped storage policies (copy an existing HG bucket policy if one exists) |
| schema 71 COA/journals/periods/posting_account_map/gl_trial_balance | migration 22 | seeds via seed_tenant_accounting; gl_trial_balance takes tenant/property params + membership check |
| schema 72 auto-posting triggers + backfill | migration 22 | sources = HostGate's own invoices/payments (08_phase_b), POS sales (12_phase_f_pos), rentals bills (10_phase_d) — INSPECT their actual shapes first and adapt; savepoint-wrapped; drafts only; idempotent per (tenant, source) |
| schema 74 banking + 75 fixed assets | migration 23 | + tenant scoping |
| lib/accounting/*.js + __tests__ | `lib/accounting/*.ts` typed | pure math ports 1:1 (keep test vectors identical); DB helpers use HG's supabase client patterns from lib/db/* |
| app/(app)/documents, expenses, accounting, banking, assets | `app/app/accounting/…` route group: `/app/documents`, `/app/expenses`, `/app/accounting`, `/app/banking`, `/app/assets` (match HG's existing nav structure — inspect app/app/layout.tsx nav and follow it) | Tailwind rebuild of the same UX; active-property context from `lib/active-property-server.ts` |
| app/(print)/print/{document,wht,vat} | HG print pattern — check how HG prints invoices today (app/app/invoices) and follow that pattern | |

## 2. Phase split

- **HG-P1 (schema layer)**: migrations 21+22+23 written, applied, verified (balanced-entry guard,
  per-tenant counter isolation proven with two test tenants THEN cleaned up, seeds run for existing
  tenants, provisionTenant() wired, backfill run per tenant with tie-out numbers reported).
- **HG-P2 (lib layer)**: `lib/accounting/*.ts` + vitest ports (money/documents/expenses/vat/banking/
  depreciation/baht-text + posting helpers), typed against generated DB types if the repo uses them.
- **HG-P3 (pages layer)**: the five surfaces + print routes + nav + app-i18n th/en, Tailwind, following
  app/app/invoices conventions; permission/role gating follows HG's existing role model (inspect
  how /app pages gate by membership role).
- **HG-P4 (integration, orchestrator)**: typecheck+vitest+build, commit, `vercel --prod` deploy,
  docs + hand-off updates, morning report.

## 3. Open product decisions taken by default (owner asleep — chosen, documented, reversible)

- Accounting enabled for ALL tenants (no plan gating yet) — HostGate has no billing-plan gates today.
- VAT default per tenant: `vat_inclusive=true` initial (Thai hotel norm), editable in property/tenant
  settings later.
- e-Tax not ported (same provider constraint as hotel-pms — see hotel-pms docs/e-tax-note.md).
