"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ReceiptText, Wallet, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STR: Record<"th" | "en", { tenants: string; bills: string; payments: string; setup: string }> = {
  th: { tenants: "ผู้เช่า", bills: "ออกบิล", payments: "การชำระเงิน", setup: "ตั้งค่าห้องเช่า" },
  en: { tenants: "Tenants", bills: "Billing", payments: "Payments", setup: "Setup" },
};

const TABS = [
  { href: "/app/rentals", icon: Users, key: "tenants" as const, exact: true },
  { href: "/app/rentals/bills", icon: ReceiptText, key: "bills" as const },
  { href: "/app/rentals/payments", icon: Wallet, key: "payments" as const },
  { href: "/app/rentals/setup", icon: SlidersHorizontal, key: "setup" as const },
];

export default function RentalsTabs() {
  const { locale } = useI18n();
  const s = STR[locale === "en" ? "en" : "th"];
  const pathname = usePathname() || "/app/rentals";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      {TABS.map(({ href, icon: Icon, key, exact }) => {
        const on = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              on
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "border border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            <Icon size={15} /> {s[key]}
          </Link>
        );
      })}
    </div>
  );
}
