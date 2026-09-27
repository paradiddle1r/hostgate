import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  user: { id: "user-a" } as {id:string} | null, cookie: "property-a", error: null as unknown,
  queries: [] as string[], filters: [] as unknown[][], caches: [] as Map<string, unknown>[], auth: 0,
}));
// Model React's request-scoped cache; clear it at each simulated request.
vi.mock("react", () => ({ cache: (fn: (...args: any[]) => unknown) => {
  const entries = new Map<string, unknown>(); state.caches.push(entries);
  return (...args: unknown[]) => { const key = JSON.stringify(args); if (!entries.has(key)) entries.set(key, fn(...args)); return entries.get(key); };
} }));
vi.mock("next/headers", () => ({ cookies: () => ({get: () => ({value:state.cookie})}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({
  auth: {getUser: async () => {state.auth++; return {data:{user:state.user}};}},
  from: (table: string) => {
    state.queries.push(table);
    let id: string | undefined;
    const q: any = {};
    for (const method of ["select","eq","in","order","limit"]) q[method] = (...args: unknown[]) => {
      state.filters.push([table,method,...args]); if(method==="eq" && args[0]==="id") id=String(args[1]); return q;
    };
    const result = () => table === "tenant_members"
      ? {data:[{tenant_id:"tenant-a",role:"owner",tenants:{id:"tenant-a",name:"A",slug:"a",plan:"free"}}],error:state.error}
      : {data: id && id !== "property-a" ? null : {id:"property-a",tenant_id:"tenant-a"},error:null};
    q.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve,reject);
    q.maybeSingle = async () => result(); return q;
  },
}) }));
import { getActiveProperty, getMemberships, listTenantProperties } from "./active-property-server";
beforeEach(() => {
  state.user={id:"user-a"};state.cookie="property-a";state.error=null;state.queries=[];state.filters=[];state.auth=0;
  state.caches.forEach(c=>c.clear());
});
it("shares one membership/auth read between layout, calendar and property switcher", async () => {
  const [active,members] = await Promise.all([getActiveProperty(),getMemberships(),listTenantProperties()]);
  expect(active.ok && active.data.tenant.id).toBe("tenant-a");
  expect(members.ok && members.data[0].role).toBe("owner");
  expect(state.queries.filter(t=>t==="tenant_members")).toHaveLength(1);
  expect(state.queries).not.toContain("tenants"); expect(state.auth).toBe(1);
});
it("scopes both stale/foreign cookie lookup and fallback to authorized tenants", async () => {
  state.cookie="foreign-property";
  const active=await getActiveProperty();
  expect(active.ok && active.data.property.id).toBe("property-a");
  expect(state.filters.filter(f=>f[0]==="properties" && f[1]==="in")).toEqual([
    ["properties","in","tenant_id",["tenant-a"]],["properties","in","tenant_id",["tenant-a"]],
  ]);
});
it("does not query properties on membership failure", async () => {
  state.error={message:"membership unavailable"};
  expect((await getActiveProperty()).ok).toBe(false);
  expect(state.queries).toEqual(["tenant_members"]);
});
it("rejects signed-out requests without DB queries", async () => {
  state.user=null;
  expect(await getActiveProperty()).toMatchObject({ok:false,code:"HG-AUTH-401"});
  expect(state.queries).toEqual([]);
});
it("does not reuse authorization across request boundaries", async () => {
  expect((await getActiveProperty()).ok).toBe(true);
  state.caches.forEach(c=>c.clear());state.user=null;
  expect(await getActiveProperty()).toMatchObject({ok:false,code:"HG-AUTH-401"});
});
