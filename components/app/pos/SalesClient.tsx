"use client";

// Mini-bar POS sales history. Data arrives once via server props; the payment
// filter runs in-memory. Each row expands to show its line items, lazy-loaded
// on first expand via fetchSaleItems() and cached per sale id. The KPI strip
// summarises today's sales (count + revenue) using the browser's local date.

import { useMemo, useState } from "react";
import {
  Receipt,
  ShoppingBag,
  ChevronDown,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  BedDouble,
} from "lucide-react";
import type { PosSale, PosSaleItem } from "@/lib/db/pos";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import { fetchSaleItems } from "@/app/app/pos/actions";

type PayMethod = PosSale["payment_method"];

const METHODS: PayMethod[] = ["cash", "transfer", "card", "room"];

// Chip colours per payment method. cash reads as muted; the rest are tinted.
const METHOD_COLOR: Record<PayMethod, string> = {
  cash: "#6b7280",
  transfer: "#2563eb",
  card: "#7c3aed",
  room: "#d97706",
};

const STR = {
  th: {
    title: "ประวัติการขาย",
    count: "รายการ",
    todaySales: "ยอดขายวันนี้",
    todayRevenue: "รายได้วันนี้",
    sales: "ครั้ง",
    all: "ทั้งหมด",
    cash: "เงินสด",
    transfer: "โอน",
    card: "บัตร",
    room: "ลงห้อง",
    code: "เลขที่",
    time: "เวลา",
    method: "การชำระ",
    total: "ยอดรวม",
    items: "รายการสินค้า",
    note: "หมายเหตุ",
    loading: "กำลังโหลด…",
    noItems: "ไม่มีรายการสินค้า",
    empty: "ยังไม่มีการขาย",
    emptyHint: "การขายจาก POS จะแสดงที่นี่",
  },
  en: {
    title: "Sales history",
    count: "sales",
    todaySales: "Today's sales",
    todayRevenue: "Today's revenue",
    sales: "sales",
    all: "All",
    cash: "Cash",
    transfer: "Transfer",
    card: "Card",
    room: "Room",
    code: "Code",
    time: "Time",
    method: "Payment",
    total: "Total",
    items: "Items",
    note: "Note",
    loading: "Loading…",
    noItems: "No items",
    empty: "No sales yet",
    emptyHint: "Sales rung up in the POS will show here.",
  },
} as const;

const METHOD_ICON: Record<PayMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: ArrowLeftRight,
  card: CreditCard,
  room: BedDouble,
};

export default function SalesClient({
  sales,
  currency,
}: {
  sales: PosSale[];
  currency: string;
}) {
  const toast = useToast();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const [method, setMethod] = useState<PayMethod | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsBySale, setItemsBySale] = useState<Record<string, PosSaleItem[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;
  const methodLabel = (m: PayMethod) => tr[m] as string;

  // KPIs — today's count + revenue, by the browser's local date string.
  const today = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    let count = 0;
    let revenue = 0;
    for (const s of sales) {
      if (new Date(s.created_at).toLocaleDateString() === todayStr) {
        count += 1;
        revenue += Number(s.total) || 0;
      }
    }
    return { count, revenue };
  }, [sales]);

  const rows = useMemo(
    () => (method === "all" ? sales : sales.filter((s) => s.payment_method === method)),
    [sales, method],
  );

  async function toggle(sale: PosSale) {
    // Collapse if already open.
    if (expanded === sale.id) {
      setExpanded(null);
      return;
    }
    setExpanded(sale.id);
    // Lazy-load line items once, then cache.
    if (itemsBySale[sale.id] == null && loadingId !== sale.id) {
      setLoadingId(sale.id);
      const res = await fetchSaleItems(sale.id);
      setLoadingId(null);
      if (res.ok) {
        setItemsBySale((m) => ({ ...m, [sale.id]: res.data }));
      } else {
        toast.error(`${res.code} · ${res.message}`);
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {sales.length} {tr.count}
        </span>
      </div>

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="app-surface rounded-2xl border border-[var(--app-border)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {tr.todaySales}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{today.count}</p>
          <p className="text-xs text-[var(--app-fg-muted)]">{tr.sales}</p>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {tr.todayRevenue}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {money(today.revenue)}
          </p>
        </div>
      </div>

      {/* Payment filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMethod("all")}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            method === "all"
              ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
              : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
          }`}
        >
          {tr.all}
        </button>
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              method === m
                ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {methodLabel(m)}
          </button>
        ))}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Receipt size={22} />}
            title={tr.empty}
            hint={tr.emptyHint}
          />
        </div>
      ) : (
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          {/* Column header */}
          <div className="hidden grid-cols-[1fr_1.4fr_auto_auto_2rem] gap-3 border-b border-[var(--app-border)] px-4 py-2.5 text-xs uppercase text-[var(--app-fg-muted)] sm:grid">
            <span className="font-medium">{tr.code}</span>
            <span className="font-medium">{tr.time}</span>
            <span className="font-medium">{tr.method}</span>
            <span className="text-right font-medium">{tr.total}</span>
            <span />
          </div>

          <ul>
            {rows.map((s) => {
              const open = expanded === s.id;
              const items = itemsBySale[s.id];
              const Icon = METHOD_ICON[s.payment_method];
              return (
                <li
                  key={s.id}
                  className="border-t border-[var(--app-border)] first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    aria-expanded={open}
                    className="grid w-full grid-cols-[1fr_auto_2rem] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--app-surface-2)] sm:grid-cols-[1fr_1.4fr_auto_auto_2rem]"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {s.code ?? <span className="text-[var(--app-fg-muted)]">—</span>}
                    </span>
                    <span className="hidden whitespace-nowrap text-[var(--app-fg-muted)] sm:block">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                    <span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ background: METHOD_COLOR[s.payment_method] }}
                      >
                        <Icon size={12} />
                        {methodLabel(s.payment_method)}
                      </span>
                    </span>
                    <span className="text-right font-medium tabular-nums whitespace-nowrap">
                      {money(s.total)}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`justify-self-end text-[var(--app-fg-muted)] transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded panel */}
                  {open && (
                    <div className="border-t border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
                        {tr.items}
                      </p>
                      {items == null ? (
                        <p className="text-sm text-[var(--app-fg-muted)]">
                          {tr.loading}
                        </p>
                      ) : items.length === 0 ? (
                        <p className="text-sm text-[var(--app-fg-muted)]">
                          {tr.noItems}
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--app-border)]">
                          {items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between gap-3 py-1.5 text-sm"
                            >
                              <span className="min-w-0">
                                <span className="font-medium">{it.name}</span>{" "}
                                <span className="text-[var(--app-fg-muted)]">
                                  × {it.qty}
                                </span>
                              </span>
                              <span className="whitespace-nowrap tabular-nums">
                                {money(it.line_total)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.note && (
                        <p className="mt-3 text-sm">
                          <span className="text-[var(--app-fg-muted)]">
                            {tr.note}:{" "}
                          </span>
                          {s.note}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
