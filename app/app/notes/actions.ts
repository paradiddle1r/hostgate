"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  Note,
  NoteInput,
} from "@/lib/db/notes";
import { getActiveProperty } from "@/lib/active-property-server";

/** Create a note on the active property (tenant + property scoped). */
export async function newNote(input: NoteInput): Promise<ActionResult<Note>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property } = active.data;
  const res = await createNote(property.id, property.tenant_id, input);
  if (res.ok) revalidatePath("/app/notes");
  return res;
}

/** Patch a note (body / color / pinned / done). */
export async function editNote(
  id: string,
  patch: Partial<NoteInput>
): Promise<ActionResult<Note>> {
  const res = await updateNote(id, patch);
  if (res.ok) revalidatePath("/app/notes");
  return res;
}

/** Delete a note. */
export async function removeNote(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteNote(id);
  if (res.ok) revalidatePath("/app/notes");
  return res;
}

/**
 * Lightweight feed for the floating <NotesWidget/>. AppShell can't async-load,
 * so the widget self-fetches this on mount (and after each quick-add). Returns
 * every note for the active property — the widget filters to active (!done).
 */
export async function getNotesForWidget(): Promise<ActionResult<Note[]>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  return listNotes(active.data.property.id);
}
