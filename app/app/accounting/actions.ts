"use server";

// Server actions for the General-Ledger surface (/app/accounting). Reads (trial
// balance, ledger drill-down, VAT reports, journal lists, chart of accounts,
// periods) are open to every role — staff can view everything. Writes that post
// or lock the books (approve/void an entry, create/edit/deactivate an account,
// import a chart, close/reopen a period) are gated to owner/admin via
// canApprove(getActiveRole()). Manual draft entries CAN be created/edited by
// staff; only approval mints the running number.

import { revalidatePath } from "next/cache";
import { ActionResult, ActionErr, fail } from "@/lib/errors";
import { getActiveProperty, getCurrentUser } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/db/properties";
import {
  listJournalEntries,
  getJournalEntry,
  createManualEntry,
  updateManualEntry,
  approveEntry,
  voidEntry,
  listAccounts,
  createAccount,
  updateAccount,
  deactivateAccount,
  bulkInsertAccounts,
  trialBalance,
  ledgerForAccount,
  listPeriods,
  closePeriod,
  reopenPeriod,
  vatSalesReport,
  vatPurchaseReport,
  type JournalEntry,
  type JournalLine,
  type JournalHeaderInput,
  type JournalLineInput,
  type Account,
  type AccountCategory,
  type TbRow,
  type LedgerLine,
  type AccountingPeriod,
  type CoaCsvRow,
  type ReportRow,
  type EntryStatus,
} from "@/lib/db/gl";
import type { JournalBook } from "@/lib/accounting/posting";

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return { ok: true as const, propertyId: p.id, tenantId: p.tenant_id };
}

async function requireApprover(): Promise<ActionErr | null> {
  const role = await getActiveRole();
  if (!canApprove(role)) return fail("HG-AUTH-403", "Only an owner or admin can do that.");
  return null;
}

// ── journal entries ──────────────────────────────────────────────────────────
export async function loadJournalEntries(
  opts?: { book?: JournalBook; status?: EntryStatus }
): Promise<ActionResult<JournalEntry[]>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return listJournalEntries(c.propertyId, opts);
}

export async function loadJournalEntry(
  id: string
): Promise<ActionResult<{ entry: JournalEntry; lines: JournalLine[] }>> {
  return getJournalEntry(id);
}

export async function createEntryAction(
  header: JournalHeaderInput,
  lines: JournalLineInput[]
): Promise<ActionResult<JournalEntry>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createManualEntry(c.propertyId, c.tenantId, header, lines);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function updateEntryAction(
  id: string,
  header: JournalHeaderInput,
  lines: JournalLineInput[]
): Promise<ActionResult<JournalEntry>> {
  const res = await updateManualEntry(id, header, lines);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function approveEntryAction(id: string): Promise<ActionResult<JournalEntry>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await approveEntry(id);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function voidEntryAction(id: string, reason?: string): Promise<ActionResult<JournalEntry>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await voidEntry(id, reason);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

// ── chart of accounts ────────────────────────────────────────────────────────
export async function loadAccounts(): Promise<ActionResult<Account[]>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return listAccounts(c.propertyId);
}

export async function createAccountAction(account: {
  code: string;
  name_th: string;
  name_en?: string | null;
  category: AccountCategory;
  parent_code?: string | null;
  sort_order?: number;
}): Promise<ActionResult<Account>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await createAccount(c.propertyId, c.tenantId, account);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function updateAccountAction(
  code: string,
  patch: Partial<Pick<Account, "name_th" | "name_en" | "category" | "parent_code" | "sort_order" | "active">>
): Promise<ActionResult<Account>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await updateAccount(c.propertyId, c.tenantId, code, patch);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function deactivateAccountAction(code: string): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await deactivateAccount(c.propertyId, c.tenantId, code);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function importAccountsAction(
  rows: Array<Partial<CoaCsvRow>>
): Promise<ActionResult<{ imported: number }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await bulkInsertAccounts(c.propertyId, c.tenantId, rows);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

// ── statements ───────────────────────────────────────────────────────────────
export async function loadTrialBalance(
  from: string,
  to: string,
  includeDrafts = false
): Promise<ActionResult<TbRow[]>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return trialBalance(c.tenantId, c.propertyId, from, to, includeDrafts);
}

export async function loadLedger(
  accountCode: string,
  from?: string,
  to?: string
): Promise<ActionResult<LedgerLine[]>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return ledgerForAccount(c.propertyId, accountCode, from, to);
}

// ── VAT reports ──────────────────────────────────────────────────────────────
export async function loadVatReports(
  year: number,
  month: number
): Promise<ActionResult<{ sales: ReportRow[]; purchase: ReportRow[] }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const [sales, purchase] = await Promise.all([
    vatSalesReport(c.tenantId, c.propertyId, year, month),
    vatPurchaseReport(c.tenantId, c.propertyId, year, month),
  ]);
  if (!sales.ok) return sales;
  if (!purchase.ok) return purchase;
  return { ok: true, data: { sales: sales.data, purchase: purchase.data } };
}

// ── VAT print loader ──────────────────────────────────────────────────────────
// The /print/vat route is a client component (doc-language toggle + auto-print),
// so it pulls its data through this server action. RLS scopes every read.
export type PrintVatPayload = {
  property: Property | null;
  year: number;
  month: number;
  sales: ReportRow[];
  purchase: ReportRow[];
};

export async function loadVatForPrint(year: number, month: number): Promise<ActionResult<PrintVatPayload>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const [sales, purchase] = await Promise.all([
    vatSalesReport(c.tenantId, c.propertyId, year, month),
    vatPurchaseReport(c.tenantId, c.propertyId, year, month),
  ]);
  if (!sales.ok) return sales;
  if (!purchase.ok) return purchase;
  const supabase = createClient();
  const { data: property } = await supabase.from("properties").select("*").eq("id", c.propertyId).maybeSingle();
  return { ok: true, data: { property: (property as Property) ?? null, year, month, sales: sales.data, purchase: purchase.data } };
}

// ── periods ──────────────────────────────────────────────────────────────────
export async function loadPeriods(): Promise<ActionResult<AccountingPeriod[]>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return listPeriods(c.propertyId);
}

export async function closePeriodAction(period: string): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const user = await getCurrentUser();
  const res = await closePeriod(c.propertyId, c.tenantId, period, user?.id ?? null);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}

export async function reopenPeriodAction(period: string): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const user = await getCurrentUser();
  const res = await reopenPeriod(c.propertyId, c.tenantId, period, user?.id ?? null);
  if (res.ok) revalidatePath("/app/accounting");
  return res;
}
