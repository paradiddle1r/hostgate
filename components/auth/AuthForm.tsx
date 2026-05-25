"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n, pick } from "@/lib/i18n";

type Mode = "login" | "signup";

interface Props {
  mode: Mode;
}

/**
 * Shared sign-in / sign-up form.
 * Renders 4 social buttons (Google / Apple / Facebook / LINE-disabled),
 * then an email field that triggers Supabase magic-link OTP.
 *
 * On submit the Supabase callback URL is /auth/callback which decides
 * whether to send the user to /onboarding (new account) or the app shell.
 */
export default function AuthForm({ mode }: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState<null | "google" | "apple" | "facebook" | "email">(null);
  const [error, setError] = useState<string | null>(null);

  const oauth = async (provider: "google" | "apple" | "facebook") => {
    setError(null);
    setSubmitting(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(
        /provider is not enabled/i.test(error.message)
          ? pick(t.auth.error.providerNotConfigured, locale)
          : pick(t.auth.error.generic, locale)
      );
      setSubmitting(null);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError(pick(t.auth.error.invalidEmail, locale));
      return;
    }
    setSubmitting("email");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(null);
    if (error) {
      setError(pick(t.auth.error.generic, locale));
      return;
    }
    // Page lives in the (auth) route group — the parentheses are stripped from
    // the URL, so the actual path is /verify-email (not /auth/verify-email).
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  };

  const copy = mode === "login" ? t.auth.login : t.auth.signup;
  const otherMode = mode === "login" ? "/signup" : "/login";

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-zinc-200/60 bg-white/80 p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">
          {pick(copy.title, locale)}
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {pick(copy.subtitle, locale)}{" "}
          <Link href={otherMode} className="font-medium text-indigo-600 hover:text-indigo-700">
            {pick(copy.switchCta, locale)}
          </Link>
        </p>

        <div className="mt-7 space-y-2.5">
          <ProviderButton
            onClick={() => oauth("google")}
            loading={submitting === "google"}
            disabled={submitting !== null}
            label={pick(t.auth.google, locale)}
            variant="white"
            icon={<GoogleIcon />}
          />
          <ProviderButton
            onClick={() => oauth("apple")}
            loading={submitting === "apple"}
            disabled={submitting !== null}
            label={pick(t.auth.apple, locale)}
            variant="black"
            icon={<AppleIcon />}
          />
          <ProviderButton
            onClick={() => oauth("facebook")}
            loading={submitting === "facebook"}
            disabled={submitting !== null}
            label={pick(t.auth.facebook, locale)}
            variant="blue"
            icon={<FacebookIcon />}
          />
          <ProviderButton
            onClick={() => undefined}
            loading={false}
            disabled
            label={pick(t.auth.line, locale)}
            variant="green"
            icon={<LineIcon />}
            badge={pick(t.auth.lineSoon, locale)}
          />
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="h-px w-full bg-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider text-zinc-400">
            <span className="bg-white/80 px-3">{pick(t.auth.orDivider, locale)}</span>
          </div>
        </div>

        <form onSubmit={submitEmail} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={pick(t.auth.emailPlaceholder, locale)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting !== null}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
          />
          <button
            type="submit"
            disabled={submitting !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {submitting === "email" ? pick(t.auth.emailSending, locale) : pick(t.auth.emailCta, locale)}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
          {pick(t.auth.terms, locale)}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- */

interface ProviderButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  label: string;
  variant: "white" | "black" | "blue" | "green";
  icon: React.ReactNode;
  badge?: string;
}

function ProviderButton({ onClick, loading, disabled, label, variant, icon, badge }: ProviderButtonProps) {
  const styles =
    variant === "white"
      ? "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
      : variant === "black"
      ? "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "blue"
      ? "border border-[#1877F2] bg-[#1877F2] text-white hover:bg-[#1666d4]"
      : "border border-[#06C755] bg-[#06C755] text-white hover:bg-[#05b04c]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span>{loading ? "…" : label}</span>
      {badge && (
        <span className="absolute right-3 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ---- Provider brand glyphs (inline SVG, color: currentColor for white variant) ---- */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.25h2.9c1.7-1.56 2.69-3.86 2.69-6.6z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.25c-.8.54-1.83.86-3.05.86-2.35 0-4.34-1.59-5.05-3.71H.96v2.34A9 9 0 009 18z"/>
      <path fill="#FBBC04" d="M3.95 10.72A5.4 5.4 0 013.66 9c0-.6.1-1.18.29-1.72V4.94H.96A8.97 8.97 0 000 9c0 1.45.35 2.83.96 4.06l2.99-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.86 11.43 0 9 0A9 9 0 00.96 4.94l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M16.36 12.7c0-2.41 1.97-3.58 2.06-3.63-1.12-1.64-2.87-1.86-3.49-1.89-1.49-.15-2.9.87-3.66.87-.75 0-1.92-.84-3.16-.82-1.62.02-3.12.94-3.95 2.39-1.68 2.92-.43 7.25 1.21 9.62.8 1.16 1.76 2.46 3.02 2.42 1.22-.05 1.68-.79 3.16-.79 1.47 0 1.89.79 3.18.76 1.31-.02 2.14-1.18 2.94-2.35.92-1.35 1.31-2.66 1.33-2.73-.03-.01-2.55-.98-2.58-3.85zM13.94 5.42c.66-.81 1.11-1.93 1-3.04-.95.04-2.11.63-2.79 1.42-.61.71-1.15 1.85-1.01 2.93 1.07.08 2.14-.55 2.8-1.31z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/>
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 3C6.48 3 2 6.6 2 11.04c0 3.98 3.55 7.33 8.36 7.97.32.07.77.21.88.49.1.25.07.64.03.9l-.14.85c-.04.25-.2.99.87.54 1.07-.46 5.78-3.4 7.89-5.83C21.4 14.57 22 12.91 22 11.04 22 6.6 17.52 3 12 3zM8.55 13.62H6.51c-.3 0-.54-.24-.54-.54V9.34c0-.3.24-.54.54-.54s.54.24.54.54v3.2h1.5c.3 0 .54.24.54.54s-.24.54-.54.54zm2.13-.54c0 .3-.24.54-.54.54s-.54-.24-.54-.54V9.34c0-.3.24-.54.54-.54s.54.24.54.54v3.74zm4.42 0c0 .24-.15.45-.38.52-.05.02-.11.02-.16.02-.18 0-.34-.08-.44-.22l-2.07-2.82v2.5c0 .3-.24.54-.54.54s-.54-.24-.54-.54V9.34c0-.24.15-.45.38-.52.05-.02.11-.02.16-.02.17 0 .33.08.43.22l2.08 2.83v-2.5c0-.3.24-.54.54-.54s.54.24.54.54v3.74zm3.07-2.41c.3 0 .54.24.54.54s-.24.54-.54.54h-1.5v.79h1.5c.3 0 .54.24.54.54s-.24.54-.54.54h-2.04c-.3 0-.54-.24-.54-.54V9.34c0-.3.24-.54.54-.54h2.04c.3 0 .54.24.54.54s-.24.54-.54.54h-1.5v.79h1.5z"/>
    </svg>
  );
}
