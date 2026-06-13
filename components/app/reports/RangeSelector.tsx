"use client";

// Date-range selector for the Reports page.
//
// Pushes ?from=YYYY-MM-DD&to=YYYY-MM-DD into the URL; the server-rendered page
// reads them, snaps to month boundaries, and re-fetches. Preset chips cover the
// common spans (Last 3 / 6 / 12 / 24 months + YTD); the date inputs always show
// the current selection for any custom span. The active preset is auto-detected
// from the current range so a refresh lights up the right chip.

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "ช่วงเวลา",
    p3: "3 เดือน",
    p6: "6 เดือน",
    p12: "12 เดือน",
    p24: "24 เดือน",
    ytd: "ปีนี้",
    custom: "กำหนดเอง",
    from: "ตั้งแต่",
    to: "ถึง",
    apply: "ใช้",
    month: "เดือน",
    months: "เดือน",
  },
  en: {
    title: "Date range",
    p3: "Last 3 mo",
    p6: "Last 6 mo",
    p12: "Last 12 mo",
    p24: "Last 24 mo",
    ytd: "Year to date",
    custom: "Custom",
    from: "From",
    to: "To",
    apply: "Apply",
    month: "month",
    months: "months",
  },
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Compute (from, to) for a preset, anchored on the current calendar month (UTC).
function presetRange(key: string): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const endOfThisMonth = new Date(Date.UTC(y, m + 1, 0));
  const back = (n: number) => new Date(Date.UTC(y, m - n, 1));
  switch (key) {
    case "3m":
      return { from: ymd(back(2)), to: ymd(endOfThisMonth) };
    case "6m":
      return { from: ymd(back(5)), to: ymd(endOfThisMonth) };
    case "12m":
      return { from: ymd(back(11)), to: ymd(endOfThisMonth) };
    case "24m":
      return { from: ymd(back(23)), to: ymd(endOfThisMonth) };
    case "ytd":
      return { from: ymd(new Date(Date.UTC(y, 0, 1))), to: ymd(endOfThisMonth) };
    default:
      return null;
  }
}

const PRESETS: { key: string; labelKey: keyof (typeof STR)["en"] }[] = [
  { key: "3m", labelKey: "p3" },
  { key: "6m", labelKey: "p6" },
  { key: "12m", labelKey: "p12" },
  { key: "24m", labelKey: "p24" },
  { key: "ytd", labelKey: "ytd" },
];

// Match (from, to) to a preset at month granularity, else null (= custom).
function detectPreset(from: string, to: string): string | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key);
    if (!r) continue;
    if (from.slice(0, 7) === r.from.slice(0, 7) && to.slice(0, 7) === r.to.slice(0, 7)) {
      return p.key;
    }
  }
  return null;
}

export default function RangeSelector({
  selectedRange,
  monthsCount,
}: {
  selectedRange: { from: string; to: string };
  monthsCount: number;
}) {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];
  const router = useRouter();
  const pathname = usePathname();

  const [from, setFrom] = useState(selectedRange.from);
  const [to, setTo] = useState(selectedRange.to);

  const activePreset = useMemo(
    () => detectPreset(selectedRange.from, selectedRange.to),
    [selectedRange]
  );

  function pushRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(key: string) {
    const r = presetRange(key);
    if (!r) return;
    setFrom(r.from);
    setTo(r.to);
    pushRange(r.from, r.to);
  }

  function applyCustom() {
    if (!from || !to || from > to) return;
    pushRange(from, to);
  }

  const dirty = from !== selectedRange.from || to !== selectedRange.to;
  const customActive = activePreset === null;

  const chipBase =
    "rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 cursor-pointer";
  const chipOn = "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)] font-medium";
  const chipOff =
    "border-[var(--app-border)] bg-transparent text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]";

  return (
    <section className="app-surface flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
        <CalendarRange size={14} />
        <span className="font-semibold">{tr.title}</span>
        <span className="ml-auto font-mono normal-case tracking-normal text-[var(--app-fg)]">
          {selectedRange.from} → {selectedRange.to}
          <span className="text-[var(--app-fg-muted)]">
            {" · "}
            {monthsCount} {monthsCount === 1 ? tr.month : tr.months}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={`${chipBase} ${activePreset === p.key ? chipOn : chipOff}`}
          >
            {tr[p.labelKey]}
          </button>
        ))}
        <span className={`${chipBase} ${customActive ? chipOn : chipOff} pointer-events-none`}>
          {tr.custom}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--app-fg-muted)]">
          <span>{tr.from}</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-w-[140px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1.5 text-sm normal-case tracking-normal text-[var(--app-fg)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--app-fg-muted)]">
          <span>{tr.to}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-[140px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1.5 text-sm normal-case tracking-normal text-[var(--app-fg)]"
          />
        </label>
        <button
          type="button"
          onClick={applyCustom}
          disabled={!dirty || !from || !to || from > to}
          className={`h-9 rounded-xl border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
            dirty
              ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
              : "border-[var(--app-border)] bg-transparent text-[var(--app-fg-muted)]"
          }`}
        >
          {tr.apply}
        </button>
      </div>
    </section>
  );
}
