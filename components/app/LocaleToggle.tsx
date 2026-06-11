"use client";

// TH ⇄ EN toggle, reusing the marketing site's i18n locale state.

import { useI18n } from "@/lib/i18n";

export default function LocaleToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "th" ? "en" : "th")}
      className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]"
      aria-label="Language"
    >
      {locale === "th" ? "TH" : "EN"}
    </button>
  );
}
