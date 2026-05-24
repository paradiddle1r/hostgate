"use client";

import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="relative flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale("th")}
        className={`relative rounded-full px-3 py-1.5 transition ${
          locale === "th" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
        }`}
        aria-label="Thai"
      >
        TH
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`relative rounded-full px-3 py-1.5 transition ${
          locale === "en" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
