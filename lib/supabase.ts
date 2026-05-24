import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // ในช่วง dev ถ้ายังไม่ได้ใส่ env จะเห็น warning นี้
  // production จะ throw เพื่อไม่ให้ deploy ที่ไม่มี config
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars"
    );
  }
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  {
    auth: { persistSession: false },
  }
);

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
