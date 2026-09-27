import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("server-only",()=>({}));
const mock=vi.hoisted(()=>({active:vi.fn(),create:vi.fn(),update:vi.fn(),revalidate:vi.fn(),rooms:[] as unknown[],filters:[] as unknown[][]}));
vi.mock("@/lib/active-property-server",()=>({getActiveProperty:mock.active}));
vi.mock("@/lib/db/bookings",()=>({createBookings:mock.create,updateBooking:mock.update}));
vi.mock("next/cache",()=>({revalidatePath:mock.revalidate}));
vi.mock("@/lib/supabase/server",()=>({createClient:()=>({from:()=>{
  const q:any={};for(const m of ["select","eq","in"])q[m]=(...args:unknown[])=>{mock.filters.push([m,...args]);return q;};
  q.then=(resolve:any)=>Promise.resolve({data:mock.rooms,error:null}).then(resolve);return q;
}})}));
import {POST} from "../app/api/calendar/bookings/route";
const base={operation:"create",input:{room_id:"r1",guest_name:"Test",check_in:"2026-09-27",check_out:"2026-09-28"},extraRoomIds:["r2"]};
const request=(body:unknown,origin="https://hostgate.app")=>new NextRequest("https://hostgate.app/api/calendar/bookings",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mock.filters=[];mock.rooms=[{id:"r1",room_type_id:"rt1"},{id:"r2",room_type_id:"rt2"}];mock.active.mockResolvedValue({ok:true,data:{property:{id:"p1",tenant_id:"t1"}}});mock.create.mockResolvedValue({ok:true,data:[{id:"b1"},{id:"b2"}]});mock.update.mockResolvedValue({ok:true,data:{id:"b1"}});});
it("requires same-origin and authentication before any write",async()=>{
  expect((await POST(request(base,"https://other.example"))).status).toBe(403);expect(mock.active).not.toHaveBeenCalled();
  mock.active.mockResolvedValue({ok:false,code:"HG-AUTH-401",message:"Signed out"});
  expect((await POST(request(base))).status).toBe(403);expect(mock.create).not.toHaveBeenCalled();
});
it("creates all group rooms in one atomic DB call, with server ownership and room types",async()=>{
  expect(await (await POST(request(base))).json()).toMatchObject({ok:true,data:[{id:"b1"},{id:"b2"}]});
  expect(mock.create).toHaveBeenCalledTimes(1);
  const [property,tenant,rows]=mock.create.mock.calls[0];expect([property,tenant]).toEqual(["p1","t1"]);
  expect(rows.map((r:any)=>r.room_type_id)).toEqual(["rt1","rt2"]);expect(rows[0].booking_group_id).toBe(rows[1].booking_group_id);
  expect(mock.filters).toContainEqual(["eq","property_id","p1"]);
});
it("rejects missing/foreign rooms before creating any row",async()=>{
  mock.rooms=[{id:"r1",room_type_id:"rt1"}];expect(await (await POST(request(base))).json()).toMatchObject({ok:false,code:"HG-ROOM-404"});expect(mock.create).not.toHaveBeenCalled();
});
it("scopes updates to the active property",async()=>{
  await POST(request({operation:"update",id:"b1",input:{status:"checked_in"}}));
  expect(mock.update).toHaveBeenCalledWith("b1",{status:"checked_in"},"p1");
});
it("returns conflict without publishing a success or invalidating",async()=>{
  mock.create.mockResolvedValue({ok:false,code:"HG-BOOK-409",message:"Conflict"});
  expect(await (await POST(request(base))).json()).toMatchObject({ok:false,code:"HG-BOOK-409"});expect(mock.revalidate).not.toHaveBeenCalled();
});
