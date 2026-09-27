import { afterEach, expect, it, vi } from "vitest";
import {createBookingAction, updateBookingAction} from "./calendar-api";
afterEach(()=>vi.unstubAllGlobals());
it("returns committed rows directly, without requesting a calendar render",async()=>{
  const fetch=vi.fn().mockResolvedValue({json:async()=>({ok:true,data:[{id:"b1"}]})});vi.stubGlobal("fetch",fetch);
  expect(await updateBookingAction("b1",{room_id:"r2"})).toEqual({ok:true,data:[{id:"b1"}]});
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/api/calendar/bookings");
});
it("does not retry a write whose response was interrupted",async()=>{
  const fetch=vi.fn().mockRejectedValue(new Error("offline"));vi.stubGlobal("fetch",fetch);
  expect((await createBookingAction({check_in:"2026-09-27",check_out:"2026-09-28"})).ok).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("preserves server conflict errors for immediate rollback",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({json:async()=>({ok:false,code:"HG-BOOK-409",message:"Room occupied"})}));
  expect(await updateBookingAction("b1",{room_id:"r2"})).toMatchObject({ok:false,code:"HG-BOOK-409"});
});
