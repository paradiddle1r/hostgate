"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Package, ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STR: Record<"th" | "en", { terminal: string; products: string; sales: string }> = {
  th: { terminal: "ขายสินค้า", products: "สินค้า", sales: "ประวัติการขาย" },
  en: { terminal: "Terminal", products: "Products", sales: "Sales" },
};

const TABS = [
  { href: "/app/pos", icon: ShoppingCart, key: "terminal" as const, exact: true },
  { href: "/app/pos/products", icon: Package, key: "products" as const },
  { href: "/app/pos/sales", icon: ShoppingBag, key: "sales" as const },
];

export default function PosTabs() {
  const { locale } = useI18n();
  const s = STR[locale === "en" ? "en" : "th"];
  const pathname = usePathname() || "/app/pos";

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
