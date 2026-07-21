// lib/accounting/format.ts
// ────────────────────────────────────────────────────────────────────────────
// Leaf money-display formatters. hotel-pms re-exported these from `../format`;
// HostGate has no such module, so the accounting lib keeps its own tiny copy —
// one import surface, zero cross-module dependency (no import cycles).
// ────────────────────────────────────────────────────────────────────────────

/** "฿1,200" — full Baht amount with thousands separators. */
export const fmtBaht = (n: unknown): string =>
  "฿" + Math.round(Number(n) || 0).toLocaleString();

/** "฿42k" for ≥10k, "฿9,300" otherwise — used on chart axes. */
export const fmtBahtK = (n: unknown): string => {
  const v = Math.round(Number(n) || 0);
  return v >= 10_000 ? `฿${Math.round(v / 1000)}k` : `฿${v.toLocaleString()}`;
};
