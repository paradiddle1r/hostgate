import "server-only";

// Bank-reconciliation data layer (accounting Phase 5 port of hotel-pms
// schema_update_74 / BankingClient). Tenant+property scoped: every write stamps
// tenant_id + property_id from the active-property context; RLS
// (migration 23, `tenant_id in auth_tenant_ids()`) is the real backstop.
//
// The pure CSV parser + greedy matcher live in lib/accounting/banking.ts and run
// in the client for a live preview; this layer only persists the parsed rows and
// records match pointers (matched_type + matched_id) back at the source payment /
// expense / journal row — it never invents money.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  importStatement as importStatementCore,
  applyMatch as applyMatchCore,
  unmatchLine as unmatchLineCore,
  ignoreLine as ignoreLineCore,
  type StatementRow,
  type Candidate,
} from "@/lib/accounting/banking";

export type { StatementRow, Candidate };

export interface BankAccount {
  id: string;
  tenant_id: string;
  property_id: string;
  name: string;
  bank: string | null;
  account_no: string | null;
  coa_code: string;
  active: boolean;
  created_at: string;
}

export interface BankStatement {
  id: string;
  tenant_id: string;
  property_id: string;
  bank_account_id: string;
  filename: string | null;
  period_from: string | null;
  period_to: string | null;
  imported_by: string | null;
  created_at: string;
}

export type LineStatus = "unmatched" | "matched" | "ignored";

export interface BankStatementLine {
  id: string;
  statement_id: string;
  txn_date: string;
  description: string | null;
  amount: number;
  balance: number | null;
  matched_type: "payment" | "expense" | "journal" | null;
  matched_id: string | null;
  status: LineStatus;
}

// ── reads ──────────────────────────────────────────────────────────────────

export async function listBankAccounts(propertyId: string): Promise<ActionResult<BankAccount[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at");
    if (error) throw error;
    return ok((data ?? []) as BankAccount[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function listStatements(propertyId: string): Promise<ActionResult<BankStatement[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bank_statements")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return ok((data ?? []) as BankStatement[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getStatement(
  id: string
): Promise<ActionResult<{ statement: BankStatement; lines: BankStatementLine[] }>> {
  try {
    const supabase = createClient();
    const { data: statement, error } = await supabase
      .from("bank_statements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!statement) return fail("HG-BOOK-404", "Statement not found.");
    const { data: lines, error: lErr } = await supabase
      .from("bank_statement_lines")
      .select("*")
      .eq("statement_id", id)
      .order("txn_date");
    if (lErr) throw lErr;
    return ok({ statement: statement as BankStatement, lines: (lines ?? []) as BankStatementLine[] });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Reconciliation candidates for the active property: PMS payments (money IN,
 * positive) + paid expenses (money OUT, negative). The client normalises these
 * into signed Candidate shapes via paymentCandidate()/expenseCandidate() and
 * runs suggestMatches() against a statement's unmatched lines.
 */
export interface CandidateSources {
  payments: Array<{
    id: string;
    amount: number;
    paid_at: string | null;
    method: string | null;
    reference: string | null;
    invoice_id: string | null;
  }>;
  expenses: Array<{
    id: string;
    total: number;
    wht_amount: number;
    paid_at: string | null;
    expense_date: string | null;
    description: string | null;
    doc_ref: string | null;
  }>;
}

export async function listMatchCandidates(propertyId: string): Promise<ActionResult<CandidateSources>> {
  try {
    const supabase = createClient();
    const [pay, exp] = await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, paid_at, method, reference, invoice_id")
        .eq("property_id", propertyId)
        .order("paid_at", { ascending: false })
        .limit(1000),
      supabase
        .from("expenses")
        .select("id, total, wht_amount, paid_at, expense_date, description, doc_ref")
        .eq("property_id", propertyId)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1000),
    ]);
    if (pay.error) throw pay.error;
    if (exp.error) throw exp.error;
    return ok({
      payments: (pay.data ?? []) as CandidateSources["payments"],
      expenses: (exp.data ?? []) as CandidateSources["expenses"],
    });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── writes ─────────────────────────────────────────────────────────────────

export async function createBankAccount(
  propertyId: string,
  tenantId: string,
  fields: { name: string; bank?: string | null; account_no?: string | null; coa_code?: string }
): Promise<ActionResult<BankAccount>> {
  try {
    if (!fields.name?.trim()) return fail("HG-VALIDATION-422", "Account name is required.");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        name: fields.name.trim(),
        bank: fields.bank?.trim() || null,
        account_no: fields.account_no?.trim() || null,
        ...(fields.coa_code ? { coa_code: fields.coa_code } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as BankAccount);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function importStatement(
  propertyId: string,
  tenantId: string,
  args: { bankAccountId: string; filename?: string | null; rows: StatementRow[]; importedBy?: string | null }
): Promise<ActionResult<{ statementId: string; count: number }>> {
  try {
    const supabase = createClient();
    const res = await importStatementCore(supabase as unknown as SupabaseClient, { tenantId, propertyId }, args);
    return ok(res);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function matchLine(
  lineId: string,
  match: { type: "payment" | "expense" | "journal"; id: string }
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await applyMatchCore(supabase as unknown as SupabaseClient, lineId, match);
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function unmatchLine(lineId: string): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await unmatchLineCore(supabase as unknown as SupabaseClient, lineId);
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function ignoreLine(lineId: string): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await ignoreLineCore(supabase as unknown as SupabaseClient, lineId);
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}
