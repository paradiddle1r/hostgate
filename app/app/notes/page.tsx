import { getActiveProperty } from "@/lib/active-property-server";
import { listNotes } from "@/lib/db/notes";
import NotesClient from "@/components/app/notes/NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const notesRes = await listNotes(property.id);

  return <NotesClient initialNotes={notesRes.ok ? notesRes.data : []} />;
}
