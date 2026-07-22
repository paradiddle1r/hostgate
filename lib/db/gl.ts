import "server-only";

// General-ledger data layer: chart of accounts, journal entries + lines,
// accounting periods, trial-balance / VAT report RPCs. Mirrors the shape of
// lib/db/invoices.ts (ActionResult<T>, try/catch → mapPgError) so the
// /app/accounting server actions can stay thin.
//
// Every write stamps tenant_id + property_id explicitly — never trusts a
// client-supplied tenant. RLS (migration 22/24, `tenant_id in auth_tenant_ids()`)
// is the actual backstop; these stamps just make sure a row can never be
// inserted without them.
//
// Pure helpers (validateEntryLines, bookMeta, categoryMeta, summarizers, CSV
// builders, month/date formatting) live in lib/accounting/{posting,vat}.ts and
// are imported straight into the UI layer — this file only touches the DB.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { validateEntryLines } from "@/lib/accounting/posting";
import type {
  Account,
  AccountCategory,
  JournalBook,
  JournalLineInput,
  TbRow,
  CoaCsvRow,
} from "@/lib/accounting/posting";
import type { ReportRow } from "@/lib/accounting/vat";

export type { Account, AccountCategory, JournalBook, JournalLineInput, TbRow, CoaCsvRow, ReportRow };

export type EntryStatus = "draft" | "approved" | "void";

export interface JournalEntry {
  id: string;
  tenant_id: string;
  property_id: string;
  book: JournalBook;
  number: string | null;
  entry_date: string;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  reversal_of: string | null;
  status: EntryStatus;
  period: string;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  tenant_id: string;
  property_id: string;
  entry_id: string;
  account_code: string;
  debit: number;
  credit: number;
  memo: string | null;
  sort_order: number;
}

export interface AccountingPeriod {
  id: string;
  tenant_id: string;
  property_id: string;
  period: string;
  status: "open" | "closed";
  closed_by: string | null;
  closed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  note: string | null;
  updated_at: string;
}

export interface JournalHeaderInput {
  book: JournalBook;
  entry_date: string;
  description?: string | null;
  notes?: string | null;
}

export interface LedgerLine {
  id: string;
  debit: number;
  credit: number;
  memo: string | null;
  entry: {
    id: string;
    number: string | null;
    book: JournalBook;
    entry_date: string;
    description: string | null;
    status: EntryStatus;
  };
}

// ── journal entries ──────────────────────────────────────────────────────────

export async function listJournalEntries(
  propertyId: string,
  opts?: { book?: JournalBook; status?: EntryStatus }
): Promise<ActionResult<JournalEntry[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("journal_entries").select("*").eq("property_id", propertyId);
    if (opts?.book) query = query.eq("book", opts.book);
    if (opts?.status) query = query.eq("status", opts.status);
    const { data, error } = await query
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return ok((data ?? []) as JournalEntry[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getJournalEntry(
  id: string
): Promise<ActionResult<{ entry: JournalEntry; lines: JournalLine[] }>> {
  try {
    const supabase = createClient();
    const { data: entry, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!entry) return fail("HG-BOOK-404", "Journal entry not found.");
    const { data: lines, error: lErr } = await supabase
      .from("journal_lines")
      .select("*")
      .eq("entry_id", id)
      .order("sort_order");
    if (lErr) throw lErr;
    return ok({ entry: entry as JournalEntry, lines: (lines ?? []) as JournalLine[] });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a draft journal entry + its balanced lines. Rejects unbalanced input
 *  before ever touching the DB (the guard trigger would reject it anyway on
 *  approval, but not on insert as a draft — so this is the only backstop). */
export async function createManualEntry(
  propertyId: string,
  tenantId: string,
  header: JournalHeaderInput,
  lines: JournalLineInput[]
): Promise<ActionResult<JournalEntry>> {
  try {
    const v = validateEntryLines(lines);
    if (!v.ok) {
      return fail("HG-VALIDATION-422", "Journal entry is not balanced (" + v.errors.join(", ") + ").");
    }
    const supabase = createClient();
    const { data: entry, error } = await supabase
      .from("journal_entries")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        book: header.book,
        entry_date: header.entry_date,
        description: header.description?.trim() || null,
        notes: header.notes?.trim() || null,
        source_type: "manual",
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;

    const rows = lines
      .filter((l) => Number(l.debit) || Number(l.credit))
      .map((l, i) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        entry_id: entry.id,
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo || null,
        sort_order: i,
      }));
    if (rows.length) {
      const { error: lErr } = await supabase.from("journal_lines").insert(rows);
      if (lErr) {
        await supabase.from("journal_entries").delete().eq("id", entry.id);
        throw lErr;
      }
    }
    return ok(entry as JournalEntry);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Replace header + lines of a draft entry. Approved/void entries are immutable
 *  here (the guard trigger would reject the line writes anyway; we fail fast
 *  with a clearer message instead of surfacing the raw trigger error). */
export async function updateManualEntry(
  id: string,
  header: JournalHeaderInput,
  lines: JournalLineInput[]
): Promise<ActionResult<JournalEntry>> {
  try {
    const supabase = createClient();
    const { data: cur, error: curErr } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw curErr;
    if (!cur) return fail("HG-BOOK-404", "Journal entry not found.");
    if (cur.status !== "draft") {
      return fail("HG-VALIDATION-422", "Only draft entries can be edited.");
    }
    const v = validateEntryLines(lines);
    if (!v.ok) {
      return fail("HG-VALIDATION-422", "Journal entry is not balanced (" + v.errors.join(", ") + ").");
    }

    const { data: updated, error: uErr } = await supabase
      .from("journal_entries")
      .update({
        book: header.book,
        entry_date: header.entry_date,
        description: header.description?.trim() || null,
        notes: header.notes?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (uErr) throw uErr;

    const { error: delErr } = await supabase.from("journal_lines").delete().eq("entry_id", id);
    if (delErr) throw delErr;

    const rows = lines
      .filter((l) => Number(l.debit) || Number(l.credit))
      .map((l, i) => ({
        tenant_id: cur.tenant_id,
        property_id: cur.property_id,
        entry_id: id,
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo || null,
        sort_order: i,
      }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("journal_lines").insert(rows);
      if (insErr) throw insErr;
    }
    return ok(updated as JournalEntry);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Approve a draft (the guard trigger re-checks balance, the period lock, and
 *  mints the running number). */
export async function approveEntry(id: string): Promise<ActionResult<JournalEntry>> {
  try {
    const supabase = createClient();
    const { data: cur, error: curErr } = await supabase
      .from("journal_entries")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw curErr;
    if (!cur) return fail("HG-BOOK-404", "Journal entry not found.");
    if (cur.status !== "draft") return fail("HG-VALIDATION-422", "Only draft entries can be approved.");
    const { data, error } = await supabase
      .from("journal_entries")
      .update({ status: "approved" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as JournalEntry);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Void a draft or approved entry (draft → simply void; approved entries stay
 *  void here too — reversal posting for source-linked entries is handled by
 *  gl_void_source() on the source row itself, not from this manual action). */
export async function voidEntry(id: string, reason?: string): Promise<ActionResult<JournalEntry>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("journal_entries")
      .update({ status: "void", void_reason: reason?.trim() || null })
      .eq("id", id)
      .neq("status", "void")
      .select()
      .single();
    if (error) throw error;
    return ok(data as JournalEntry);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── chart of accounts ────────────────────────────────────────────────────────

export async function listAccounts(propertyId: string): Promise<ActionResult<Account[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("code, name_th, name_en, category, parent_code, is_system, active, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order");
    if (error) throw error;
    return ok((data ?? []) as Account[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createAccount(
  propertyId: string,
  tenantId: string,
  account: { code: string; name_th: string; name_en?: string | null; category: AccountCategory; parent_code?: string | null; sort_order?: number }
): Promise<ActionResult<Account>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        code: account.code.trim(),
        name_th: account.name_th.trim(),
        name_en: account.name_en?.trim() || null,
        category: account.category,
        parent_code: account.parent_code || null,
        sort_order: account.sort_order ?? 0,
        is_system: false,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Account);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateAccount(
  propertyId: string,
  tenantId: string,
  code: string,
  patch: Partial<Pick<Account, "name_th" | "name_en" | "category" | "parent_code" | "sort_order" | "active">>
): Promise<ActionResult<Account>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("property_id", propertyId)
      .eq("code", code)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Account);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Accounts are never deleted (journal_lines FK on update-cascade only) —
 *  is_system rows especially, but this applies to every account: turn it off. */
export async function deactivateAccount(
  propertyId: string,
  tenantId: string,
  code: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("chart_of_accounts")
      .update({ active: false })
      .eq("tenant_id", tenantId)
      .eq("property_id", propertyId)
      .eq("code", code);
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

/** CSV import: upsert by (tenant, property, code). Existing codes are updated
 *  in place (name/category/parent), never duplicated. */
export async function bulkInsertAccounts(
  propertyId: string,
  tenantId: string,
  rows: Array<Partial<CoaCsvRow>>
): Promise<ActionResult<{ imported: number }>> {
  try {
    const clean = rows
      .filter((r) => r.code && r.name_th)
      .map((r) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        code: String(r.code).trim(),
        name_th: r.name_th as string,
        name_en: r.name_en || null,
        category: r.category,
        parent_code: r.parent_code || null,
        is_system: false,
      }));
    if (!clean.length) return ok({ imported: 0 });
    const supabase = createClient();
    const { error } = await supabase
      .from("chart_of_accounts")
      .upsert(clean, { onConflict: "tenant_id,property_id,code" });
    if (error) throw error;
    return ok({ imported: clean.length });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── statements ───────────────────────────────────────────────────────────────

export async function trialBalance(
  tenantId: string,
  propertyId: string,
  from: string,
  to: string,
  includeDrafts = false
): Promise<ActionResult<TbRow[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("gl_trial_balance", {
      p_tenant: tenantId,
      p_property: propertyId,
      p_from: from,
      p_to: to,
      p_include_drafts: includeDrafts,
    });
    if (error) throw error;
    return ok((data ?? []) as TbRow[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Approved-only ledger drill-down for one account, optionally date-bounded. */
export async function ledgerForAccount(
  propertyId: string,
  accountCode: string,
  from?: string,
  to?: string
): Promise<ActionResult<LedgerLine[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("journal_lines")
      .select("id, debit, credit, memo, entry:entry_id(id, number, book, entry_date, description, status)")
      .eq("property_id", propertyId)
      .eq("account_code", accountCode);
    if (error) throw error;
    type RawRow = {
      id: string;
      debit: number;
      credit: number;
      memo: string | null;
      entry: LedgerLine["entry"] | LedgerLine["entry"][] | null;
    };
    const rows = ((data ?? []) as RawRow[])
      .map((r) => ({ ...r, entry: Array.isArray(r.entry) ? r.entry[0] : r.entry }))
      .filter((r): r is LedgerLine => {
        if (!r.entry || r.entry.status !== "approved") return false;
        if (from && r.entry.entry_date < from) return false;
        if (to && r.entry.entry_date > to) return false;
        return true;
      });
    rows.sort(
      (a, b) =>
        String(a.entry.entry_date).localeCompare(String(b.entry.entry_date)) ||
        String(a.id).localeCompare(String(b.id))
    );
    return ok(rows);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── periods ──────────────────────────────────────────────────────────────────

/** Rows that were ever explicitly closed/reopened. A period with no row is
 *  open — the UI synthesizes the last N months and overlays this status. */
export async function listPeriods(propertyId: string): Promise<ActionResult<AccountingPeriod[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounting_periods")
      .select("*")
      .eq("property_id", propertyId)
      .order("period", { ascending: false });
    if (error) throw error;
    return ok((data ?? []) as AccountingPeriod[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function closePeriod(
  propertyId: string,
  tenantId: string,
  period: string,
  uid?: string | null
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_periods").upsert(
      {
        tenant_id: tenantId,
        property_id: propertyId,
        period,
        status: "closed",
        closed_by: uid ?? null,
        closed_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,property_id,period" }
    );
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function reopenPeriod(
  propertyId: string,
  tenantId: string,
  period: string,
  uid?: string | null
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("accounting_periods").upsert(
      {
        tenant_id: tenantId,
        property_id: propertyId,
        period,
        status: "open",
        reopened_by: uid ?? null,
        reopened_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,property_id,period" }
    );
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── VAT reports ──────────────────────────────────────────────────────────────

export async function vatSalesReport(
  tenantId: string,
  propertyId: string,
  year: number,
  month: number
): Promise<ActionResult<ReportRow[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("vat_sales_report", {
      p_tenant: tenantId,
      p_property: propertyId,
      p_year: year,
      p_month: month,
    });
    if (error) throw error;
    return ok((data ?? []) as ReportRow[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function vatPurchaseReport(
  tenantId: string,
  propertyId: string,
  year: number,
  month: number
): Promise<ActionResult<ReportRow[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("vat_purchase_report", {
      p_tenant: tenantId,
      p_property: propertyId,
      p_year: year,
      p_month: month,
    });
    if (error) throw error;
    return ok((data ?? []) as ReportRow[]);
  } catch (e) {
    return mapPgError(e);
  }
}
