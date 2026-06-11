"use client";

// Theme menu: light / dark always; the two glass variants are pro-only
// (locked + "Pro" badge otherwise). Repaints instantly via onChange (updates
// the shell's data-theme) and persists through the updateTheme server action.

import { useState, useRef, useEffect } from "react";
import { Palette, Check, Lock } from "lucide-react";
import { ALL_THEMES, hasGlassThemes, isThemeAllowed } from "@/lib/plan";
import { useAppT } from "@/lib/app-i18n";
import { updateTheme } from "@/app/app/actions";

export default function ThemeToggle({
  theme,
  plan,
  onChange,
}: {
  theme: string;
  plan: string;
  onChange: (t: string) => void;
}) {
  const t = useAppT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const glassOk = hasGlassThemes(plan);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pick(next: string) {
    if (!isThemeAllowed(plan, next)) return;
    onChange(next); // optimistic repaint
    setOpen(false);
    await updateTheme(next); // persist; reverts naturally on next load if it fails
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("shell.theme")}
        className="rounded-full p-2 text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
      >
        <Palette size={18} />
      </button>
      {open && (
        <div className="app-surface absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--app-border)] py-1 shadow-xl">
          {ALL_THEMES.map((name) => {
            const locked = !glassOk && name.endsWith("-glass");
            return (
              <button
                key={name}
                type="button"
                disabled={locked}
                onClick={() => pick(name)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  locked ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--app-surface-2)]"
                }`}
              >
                <span className="flex-1">{t(`theme.${name}`)}</span>
                {theme === name && <Check size={15} className="text-[var(--app-accent)]" />}
                {locked && (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--app-fg-muted)]">
                    <Lock size={11} /> {t("theme.proOnly")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
