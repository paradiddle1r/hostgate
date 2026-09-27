import type { BookingInput } from "./db/bookings";

export type CalendarMutation =
  | { operation: "create"; input: BookingInput; extraRoomIds: string[] }
  | { operation: "update"; id: string; input: Partial<BookingInput> };
const strings = new Set(["room_id", "guest_name", "phone", "check_in", "check_out", "status", "source", "notes", "booking_type", "issue_type", "issue_detail", "reservation_no", "ota", "booked_date", "payment_method", "deposit_date", "deposit_method", "guest_first_name", "guest_last_name", "thai_name", "car_plate"]);
const numbers = new Set(["adults", "children", "total_amount", "amount_paid", "reservation_deposit", "extra_bed_charge"]);
const nonNullable = new Set(["guest_name", "check_in", "check_out", "status", "source", "booking_type", "adults", "children", "amount_paid", "extra_bed"]);
const enums: Record<string, string[]> = {
  status: ["pending", "confirmed", "checked_in", "checked_out", "cancelled"],
  source: ["direct", "walk_in", "ota", "web"],
  booking_type: ["standard", "monthly", "blocked", "oos"],
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Explicit editable fields only: never accept tenant/property/code/id from a client. */
export function parseCalendarMutation(value: unknown): CalendarMutation | null {
  if (!record(value) || !record(value.input)) return null;
  const input: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value.input)) {
    // Room type is always resolved from the selected room on the server.
    if (key === "room_type_id") continue;
    if (!strings.has(key) && !numbers.has(key) && key !== "extra_bed") return null;
    if (val === null) { if (nonNullable.has(key)) return null; }
    else if (strings.has(key)) { if (typeof val !== "string" || val.length > 10000) return null; }
    else if (numbers.has(key)) { if (typeof val !== "number" || !Number.isFinite(val) || val < 0) return null; }
    else if (typeof val !== "boolean") return null;
    if (enums[key] && !enums[key].includes(val as string)) return null;
    if ((key === "check_in" || key === "check_out") &&
      (typeof val !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(val) || !Number.isFinite(Date.parse(val)) || new Date(val).toISOString().slice(0,10) !== val)) return null;
    input[key] = val;
  }
  if (typeof input.check_in === "string" && typeof input.check_out === "string" && input.check_out <= input.check_in) return null;
  if (value.operation === "update" && typeof value.id === "string" && value.id && Object.keys(input).length) {
    return {operation:"update",id:value.id,input};
  }
  if (value.operation !== "create" || !input.room_id || !input.check_in || !input.check_out) return null;
  const extra = value.extraRoomIds ?? [];
  if (!Array.isArray(extra) || extra.length > 100 || extra.some(id => typeof id !== "string" || !id)) return null;
  const ids = [input.room_id, ...extra];
  if (new Set(ids).size !== ids.length) return null;
  return {operation:"create", input:input as unknown as BookingInput,extraRoomIds:extra};
}
