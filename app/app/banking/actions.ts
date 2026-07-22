"use server";

// Server actions for bank reconciliation (/app/banking). Reads are open to every
// role; writes (import a statement, create a bank account, match/unmatch/ignore a
// line) are gated to owner/admin via canApprove(getActiveRole()) — mirrors the
// hotel-pms banking permission (admin/supervisor rw). The CSV is parsed in the
// client with the pure parser; only the parsed rows cross to the server.

import { revalidatePath } from "next/cache";
import { ActionResult, ActionErr, fail } from "@/lib/errors";
import { getActiveProperty, getCurrentUser } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import {
  getStatement,
  listMatchCandidates,
  createBankAccount,
  importStatement,
  matchLine,
  unmatchLine,
  ignoreLine,
  type BankStatement,
  type BankStatementLine,
  type BankAccount,
  type CandidateSources,
  type StatementRow,
} from "@/lib/db/banking";

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

export async function loadStatement(
  id: string
): Promise<ActionResult<{ statement: BankStatement; lines: BankStatementLine[] }>> {
  return getStatement(id);
}

export async function loadCandidates(): Promise<ActionResult<CandidateSources>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return listMatchCandidates(c.propertyId);
}

export async function createBankAccountAction(fields: {
  name: string;
  bank?: string | null;
  account_no?: string | null;
  coa_code?: string;
}): Promise<ActionResult<BankAccount>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await createBankAccount(c.propertyId, c.tenantId, fields);
  if (res.ok) revalidatePath("/app/banking");
  return res;
}

export async function importStatementAction(args: {
  bankAccountId: string;
  filename?: string | null;
  rows: StatementRow[];
}): Promise<ActionResult<{ statementId: string; count: number }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const denied = await requireApprover();
  if (denied) return denied;
  const user = await getCurrentUser();
  const res = await importStatement(c.propertyId, c.tenantId, { ...args, importedBy: user?.id ?? null });
  if (res.ok) revalidatePath("/app/banking");
  return res;
}

export async function matchLineAction(
  lineId: string,
  match: { type: "payment" | "expense" | "journal"; id: string }
): Promise<ActionResult<{ ok: true }>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await matchLine(lineId, match);
  if (res.ok) revalidatePath("/app/banking");
  return res;
}

export async function unmatchLineAction(lineId: string): Promise<ActionResult<{ ok: true }>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await unmatchLine(lineId);
  if (res.ok) revalidatePath("/app/banking");
  return res;
}

export async function ignoreLineAction(lineId: string): Promise<ActionResult<{ ok: true }>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await ignoreLine(lineId);
  if (res.ok) revalidatePath("/app/banking");
  return res;
}
