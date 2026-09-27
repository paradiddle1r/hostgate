import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ calls: [] as unknown[][], rows: [] as unknown[], errorAt: -1 }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: (table: string) => {
  const query: any = {};
  for (const method of ["select", "eq", "gte", "lt", "order"]) query[method] = (...args: unknown[]) => {
    mock.calls.push([table, method, ...args]); return query;
  };
  query.range = async (from: number, to: number) => {
    mock.calls.push([table, "range", from, to]);
    return from === mock.errorAt ? { data: null, error: { message: "rates unavailable" } } : { data: mock.rows.slice(from, to + 1), error: null };
  };
  return query;
} }) }));
import { calendarRates } from "./db/rates";
beforeEach(() => { mock.calls = []; mock.rows = []; mock.errorAt = -1; });
it("loads prices and plan stripes in one read with property and date bounds", async () => {
  mock.rows = [{room_type_id:"rt",date:"2026-09-18",price:"1234",plan_id:"plan"}];
  expect(await calendarRates("property-a", "2026-09-18", "2026-10-18")).toEqual({ok:true,data:{rates:{rt:{"2026-09-18":1234}},planByDate:{"2026-09-18":"plan"}}});
  expect(mock.calls).toContainEqual(["daily_rates", "eq", "property_id", "property-a"]);
  expect(mock.calls).toContainEqual(["daily_rates", "gte", "date", "2026-09-18"]);
  expect(mock.calls).toContainEqual(["daily_rates", "lt", "date", "2026-10-18"]);
  expect(mock.calls.filter(c => c[1] === "range")).toHaveLength(1);
});
it("keeps prices beyond PostgREST's default row limit", async () => {
  mock.rows = Array.from({length:1023}, (_, i) => ({room_type_id:`rt${i}`,date:"2026-09-18",price:i,plan_id:null}));
  const result = await calendarRates("a", "2026-09-18", "2026-10-18");
  expect(result.ok && Object.keys(result.data.rates)).toHaveLength(1023);
  expect(mock.calls.filter(c => c[1] === "eq")).toHaveLength(3);
});
it("fails closed if a later page fails", async () => {
  mock.rows = Array.from({length:501}, () => ({room_type_id:"rt",date:"2026-09-18",price:1,plan_id:null}));
  mock.errorAt = 500;
  expect((await calendarRates("a", "2026-09-18", "2026-10-18")).ok).toBe(false);
});
