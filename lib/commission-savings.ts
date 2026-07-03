// Pure math for the Reports "Direct vs OTA" section — no DB, no React.
//
// OTA_COMMISSION_RATE is a rough, documented ESTIMATE (typical third-party
// OTA commissions run roughly 15-20%) — it is NOT a real contracted rate
// pulled from any specific OTA agreement. Callers must surface the result as
// an estimate (label/tooltip), never as exact accounting.
export const OTA_COMMISSION_RATE = 0.15;

/**
 * Estimated $ saved by taking `directRevenue` worth of bookings directly
 * (or via the property's own booking engine) instead of through an OTA that
 * would have charged `rate` commission on it.
 */
export function estimateCommissionSavings(
  directRevenue: number,
  rate: number = OTA_COMMISSION_RATE
): number {
  if (!Number.isFinite(directRevenue) || directRevenue <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return directRevenue * rate;
}
