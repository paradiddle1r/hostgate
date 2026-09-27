import { expect, it } from "vitest";
import { bookingMovePatch } from "./booking-move";

it.each([0, 1350, null])("keeps negotiated price %s and payment history when relocating a stay", (total) => {
  const original = {
    room_id: "old", room_type_id: "standard", check_in: "2026-09-15", check_out: "2026-09-17",
    total_amount: total, amount_paid: 500, reservation_deposit: 300, payment_method: "transfer",
  };
  const patch = bookingMovePatch("new", "deluxe", "2026-09-16", "2026-09-18");
  expect(patch).not.toHaveProperty("total_amount");
  expect(patch).not.toHaveProperty("amount_paid");
  expect({ ...original, ...patch }).toEqual({
    ...original, room_id: "new", room_type_id: "deluxe", check_in: "2026-09-16", check_out: "2026-09-18",
  });
});

it("supports moving into the unassigned holding lane without repricing", () => {
  expect(bookingMovePatch(null, null, "2026-09-16", "2026-09-18")).toEqual({
    room_id: null, room_type_id: null, check_in: "2026-09-16", check_out: "2026-09-18",
  });
});
