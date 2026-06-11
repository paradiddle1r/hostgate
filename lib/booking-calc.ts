// Pure booking math for the calendar — no DB, no React.

/** Nights in a half-open stay [checkIn, checkOut). Both are YYYY-MM-DD. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** YYYY-MM-DD for each NIGHT in [checkIn, checkOut). */
export function nightDates(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const start = Date.parse(checkIn + "T00:00:00Z");
  const end = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return out;
  for (let t = start; t < end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Do two half-open date ranges overlap? */
export function overlaps(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && aOut > bIn;
}

/**
 * Total stay price. Per-night price comes from rateMap[date] when present,
 * else the room type's base rate. rateMap is keyed YYYY-MM-DD.
 */
export function stayTotal(
  rateMap: Record<string, number>,
  baseRate: number,
  checkIn: string,
  checkOut: string
): { total: number; nights: number; perNight: { date: string; price: number }[] } {
  const dates = nightDates(checkIn, checkOut);
  const perNight = dates.map((date) => ({
    date,
    price: rateMap[date] != null ? Number(rateMap[date]) : Number(baseRate) || 0,
  }));
  const total = perNight.reduce((s, n) => s + n.price, 0);
  return { total, nights: perNight.length, perNight };
}
