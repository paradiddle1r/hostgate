"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
    >
      {pending ? "…" : "ออกจากระบบ"}
    </button>
  );
}
