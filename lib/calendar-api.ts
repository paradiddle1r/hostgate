import type { Booking, BookingInput, BookingStatus } from "./db/bookings";
import type { ActionResult } from "./errors";
import { fail } from "./errors";

async function mutate(body: unknown): Promise<ActionResult<Booking[]>> {
  try {
    const response = await fetch("/api/calendar/bookings", {
      method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    const result = await response.json();
    if (!result || typeof result.ok !== "boolean" || (result.ok && !Array.isArray(result.data))) throw new Error("Invalid response");
    return result;
  } catch {
    // Never retry a write automatically: an interrupted response may have committed.
    return fail("HG-UNKNOWN-500", "ไม่สามารถยืนยันผลบันทึกได้ กรุณาโหลดปฏิทินใหม่เพื่อตรวจสอบก่อนลองอีกครั้ง / Could not confirm save; reload the calendar before retrying.");
  }
}
export const createBookingAction = (input: BookingInput) => mutate({operation:"create",input});
export const createMultiRoomBooking = (input: BookingInput, extraRoomIds: string[]) => mutate({operation:"create",input,extraRoomIds});
export const updateBookingAction = (id: string, input: Partial<BookingInput>) => mutate({operation:"update",id,input});
export const setStatusAction = (id: string, status: BookingStatus) => updateBookingAction(id,{status});
