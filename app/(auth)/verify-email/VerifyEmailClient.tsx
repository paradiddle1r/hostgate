"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n, pick } from "@/lib/i18n";

export default function VerifyEmailClient({ email }: { email: string }) {
  const { locale, t } = useI18n();
  const supabase = createClient();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const body = pick(t.auth.verifyBody, locale).replace("{email}", email || "your email");

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setResent(false);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setResending(false);
    if (!error) setResent(true);
  };

  return (
    <div className="w-full max-w-sm text-center">
      <div className="rounded-2xl border border-zinc-200/60 bg-white/80 p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {pick(t.auth.verifyTitle, locale)}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{body}</p>

        <button
          type="button"
          onClick={resend}
          disabled={resending || !email}
          className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {resending ? "…" : pick(t.auth.verifyResend, locale)}
        </button>
        {resent && (
          <p className="mt-2 text-xs text-emerald-600">
            {locale === "th" ? "ส่งใหม่แล้ว" : "Link sent"}
          </p>
        )}

        <div className="mt-7 border-t border-zinc-200 pt-5">
          <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-700">
            ← {locale === "th" ? "กลับหน้าเข้าสู่ระบบ" : "Back to log in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
