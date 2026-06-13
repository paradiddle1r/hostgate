import { redirect } from "next/navigation";

// The calendar (booking grid) is the default landing — same as hotel-pms.
export default function AppHome() {
  redirect("/app/calendar");
}
