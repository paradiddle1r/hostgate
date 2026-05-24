"use client";

import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="relative flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale("th")}
        className={`relative rounded-full px-3 py-1.5 transition ${
          locale === "th" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
        }`}
        aria-label="Thai"
      >
        TH
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`relative rounded-full px-3 py-1.5 transition ${
          locale === "en" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
