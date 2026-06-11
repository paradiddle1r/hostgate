// Floor-based room-number generator for the room-setup flow.
//
// The user enters, per floor, how many rooms it has. We produce room numbers
// by the standard hotel convention `floor*100 + n` (floor 1 → 101..110, floor
// 2 → 201..208). Count is clamped to 1..99 per floor so numbers never roll
// into the next hundred.

export interface FloorSpec {
  floor: number; // 1-based floor number
  count: number; // rooms on that floor
}

export interface GeneratedRoom {
  number: string;
  floor: number;
  sort_order: number;
}

export const MAX_ROOMS_PER_FLOOR = 99;

export function generateRooms(floors: FloorSpec[]): GeneratedRoom[] {
  const out: GeneratedRoom[] = [];
  let sort = 0;
  for (const { floor, count } of floors) {
    if (floor < 0) continue;
    const n = Math.max(0, Math.min(MAX_ROOMS_PER_FLOOR, Math.floor(count)));
    for (let i = 1; i <= n; i++) {
      out.push({ number: String(floor * 100 + i), floor, sort_order: sort++ });
    }
  }
  return out;
}

/** Build floor specs from "number of floors" + "rooms per floor" (uniform). */
export function uniformFloors(numFloors: number, roomsPerFloor: number): FloorSpec[] {
  const f = Math.max(0, Math.floor(numFloors));
  const r = Math.max(0, Math.floor(roomsPerFloor));
  return Array.from({ length: f }, (_, i) => ({ floor: i + 1, count: r }));
}
