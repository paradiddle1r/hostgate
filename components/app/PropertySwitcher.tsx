"use client";

// Active-property dropdown. One static label when the tenant has a single
// property; a dropdown when pro unlocks several. Shows the property code so
// support requests can be traced.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronsUpDown, Check, Plus, Lock } from "lucide-react";
import { useActiveProperty } from "@/lib/active-property";
import { canAddProperty } from "@/lib/plan";
import { useAppT } from "@/lib/app-i18n";

export default function PropertySwitcher() {
  const { property, properties, plan, setActiveProperty } = useActiveProperty();
  const t = useAppT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const single = properties.length <= 1;
  const allowAdd = canAddProperty(plan, properties.length);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !single && setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left ${
          single ? "cursor-default" : "hover:bg-[var(--app-surface-2)]"
        }`}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{property.name}</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--app-fg-muted)]">{property.code}</div>
        </div>
        {!single && <ChevronsUpDown size={15} className="text-[var(--app-fg-muted)]" />}
      </button>

      {open && (
        <div className="app-surface absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--app-border)] shadow-xl">
          <ul className="max-h-72 overflow-auto py-1">
            {properties.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveProperty(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--app-surface-2)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-[var(--app-fg-muted)]">{p.code}</span>
                  </span>
                  {p.id === property.id && <Check size={15} className="text-[var(--app-accent)]" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--app-border)]">
            {allowAdd ? (
              <Link
                href="/app/settings?add=1"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--app-accent)] hover:bg-[var(--app-surface-2)]"
                onClick={() => setOpen(false)}
              >
                <Plus size={15} /> {t("shell.addProperty")}
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--app-fg-muted)]">
                <Lock size={13} /> {t("shell.upgradeForMore")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
