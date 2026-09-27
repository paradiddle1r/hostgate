import type { BookingInput } from "./db/bookings";

/** Moving inventory does not renegotiate an agreed price or change payments. */
export function bookingMovePatch(
  roomId: string | null,
  roomTypeId: string | null,
  checkIn: string,
  checkOut: string,
): Pick<BookingInput, "room_id" | "room_type_id" | "check_in" | "check_out"> {
  return { room_id: roomId, room_type_id: roomTypeId, check_in: checkIn, check_out: checkOut };
}
