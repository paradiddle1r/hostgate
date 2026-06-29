/**
 * Legacy single-file export. Kept for backward compatibility with the
 * contact form. New code should import from `@/lib/supabase/client` (browser)
 * or `@/lib/supabase/server` (Server Components).
 */
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string;
  property_name?: string;
  rooms?: string;
  message?: string;
  source?: string;
}

export async function submitContact(input: ContactSubmission) {
  return supabase.from("contact_submissions").insert([
    {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      property_name: input.property_name ?? null,
      rooms: input.rooms ?? null,
      message: input.message ?? null,
      source: input.source ?? "marketing-site",
    },
  ]);
}

export async function joinWaitlist(email: string) {
  return supabase.from("waitlist").insert([{ email, source: "hero" }]);
}
