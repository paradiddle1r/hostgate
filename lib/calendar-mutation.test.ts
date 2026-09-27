import { describe, expect, it } from "vitest";
import { parseCalendarMutation } from "./calendar-mutation";
const base={operation:"create",input:{room_id:"r1",guest_name:"Test",check_in:"2026-09-27",check_out:"2026-09-28"}};
describe("calendar write boundary",()=>{
  it("accepts create/group and derives room type server-side",()=>{
    expect(parseCalendarMutation({...base,input:{...base.input,room_type_id:"forged"},extraRoomIds:["r2"]})).toEqual({...base,extraRoomIds:["r2"]});
  });
  it.each(["tenant_id","property_id","code","id","booking_group_id"])("rejects client ownership field %s",key=>{
    expect(parseCalendarMutation({...base,input:{...base.input,[key]:"other"}})).toBeNull();
  });
  it.each([null,{}, {operation:"update",id:"x",input:{}}, {...base,extraRoomIds:["r1"]}, {...base,extraRoomIds:[1]}])("rejects malformed mutation %j",input=>expect(parseCalendarMutation(input)).toBeNull());
  it.each([{check_out:"2026-09-26"},{check_in:"2026-02-30"},{status:"deleted"},{total_amount:-1},{extra_bed:"yes"},{amount_paid:null}])("rejects invalid values %j",patch=>expect(parseCalendarMutation({...base,input:{...base.input,...patch}})).toBeNull());
  it("accepts a move without changing payment fields",()=>{
    const move={operation:"update",id:"b1",input:{room_id:"r2",check_in:"2026-09-28",check_out:"2026-09-30"}};
    expect(parseCalendarMutation(move)).toEqual(move);
  });
});
