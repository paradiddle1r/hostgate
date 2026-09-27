import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import { createBookings, updateBooking } from "@/lib/db/bookings";
import { parseCalendarMutation } from "@/lib/calendar-mutation";
import { fail, mapPgError, ok } from "@/lib/errors";

export const dynamic = "force-dynamic";

// JSON mutations return committed rows without rendering the whole calendar's
// RSC tree on the save path. RLS and database conflict triggers still apply.
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(fail("HG-AUTH-403", "Invalid request origin"), { status: 403 });
  }
  try {
    const mutation = parseCalendarMutation(await request.json());
    if (!mutation) return NextResponse.json(fail("HG-BOOK-422", "Invalid booking input"), {status:400});
    const active = await getActiveProperty();
    if (!active.ok) return NextResponse.json(active, {status:403});
    const { property } = active.data;
    const roomIds = mutation.operation === "create"
      ? [mutation.input.room_id!, ...mutation.extraRoomIds]
      : mutation.input.room_id ? [mutation.input.room_id] : [];
    const roomTypes = new Map<string, string | null>();
    if (roomIds.length) {
      const {data, error} = await createClient().from("rooms").select("id, room_type_id")
        .eq("property_id",property.id).eq("status","active").in("id",roomIds);
      if (error) throw error;
      if (data?.length !== roomIds.length) return NextResponse.json(fail("HG-ROOM-404","Room not found in this property"),{status:400});
      for (const room of data) roomTypes.set(room.id,room.room_type_id);
    }
    let result;
    if (mutation.operation === "create") {
      const groupId = roomIds.length > 1 ? crypto.randomUUID() : null;
      result = await createBookings(property.id,property.tenant_id,roomIds.map(roomId => ({
        ...mutation.input, room_id:roomId, room_type_id:roomTypes.get(roomId) ?? null, booking_group_id:groupId,
      })));
    } else {
      const patch = {...mutation.input};
      if ("room_id" in patch) patch.room_type_id = patch.room_id ? roomTypes.get(patch.room_id) ?? null : null;
      const updated = await updateBooking(mutation.id,patch,property.id);
      result = updated.ok ? ok([updated.data]) : updated;
    }
    if (result.ok) {
      // Route-handler invalidation does not add an RSC render to this response.
      revalidatePath("/app/calendar");
      revalidatePath("/app/bookings");
    }
    return NextResponse.json(result, {headers:{"Cache-Control":"no-store"}});
  } catch (e) {
    return NextResponse.json(mapPgError(e), {status:500});
  }
}
