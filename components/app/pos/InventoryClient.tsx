"use client";

// Mini-bar POS inventory. Server-props for stock levels + recent movements;
// the adjust control writes a pos_stock_movements row + bumps stock via the
// adjustProductStock server action, then router.refresh()es. Mirrors hotel-pms's
// Inventory page: low-stock banner, stock-levels table (on-hand / low-at /
// stock value), and a movements feed.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Boxes } from "lucide-react";
import type { PosProduct, StockMovement } from "@/lib/db/pos";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { adjustProductStock } from "@/app/app/pos/actions";

const STR = {
  th: {
    title: "สต๊อก",
    sub: "ติดตามจำนวนคงเหลือและบันทึกการเคลื่อนไหว",
    lowBannerOne: "สินค้าใกล้หมด — มี",
    lowBannerItems: "รายการที่ต้องเติม",
    stockLevels: "ระดับสต๊อก",
    product: "สินค้า",
    onHand: "คงเหลือ",
    lowAt: "แจ้งเตือนเมื่อ",
    stockValue: "มูลค่าสต๊อก",
    adjust: "ปรับ",
    movements: "การเคลื่อนไหวล่าสุด",
    when: "เมื่อ",
    type: "ประเภท",
    qty: "จำนวน",
    reason: "เหตุผล",
    noMovements: "ยังไม่มีการเคลื่อนไหว",
    empty: "ยังไม่มีสินค้า",
    emptyHint: "เพิ่มสินค้าที่หน้าสินค้า",
    adjustTitle: "ปรับสต๊อก",
    currentlyOnHand: "คงเหลือปัจจุบัน",
    stockIn: "รับเข้า (เติมสต๊อก)",
    manualAdjust: "ปรับเอง (+/-)",
    qtyReceived: "จำนวนที่รับเข้า",
    adjustment: "ปรับ (+ เพิ่ม, - ลด)",
    reasonNote: "เหตุผล / หมายเหตุ",
    inPh: "เช่น 12",
    adjPh: "เช่น -2 ของแตก",
    inReasonPh: "ใบส่งของ #…",
    adjReasonPh: "ของแตก, สูญหาย, นับใหม่…",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    cancel: "ยกเลิก",
    needQty: "จำนวนต้องไม่เป็นศูนย์",
    in: "รับเข้า",
    sale: "ขาย",
    void: "คืน",
  },
  en: {
    title: "Inventory",
    sub: "Track stock levels and record movements.",
    lowBannerOne: "Low stock —",
    lowBannerItems: "item(s) need restocking",
    stockLevels: "Stock levels",
    product: "Product",
    onHand: "On hand",
    lowAt: "Low at",
    stockValue: "Stock value",
    adjust: "Adjust",
    movements: "Recent stock movements",
    when: "When",
    type: "Type",
    qty: "Qty",
    reason: "Reason",
    noMovements: "No movements yet.",
    empty: "No products yet",
    emptyHint: "Add products on the Products page.",
    adjustTitle: "Adjust stock",
    currentlyOnHand: "Currently on hand",
    stockIn: "Stock in (restock)",
    manualAdjust: "Manual adjust (+/-)",
    qtyReceived: "Quantity received",
    adjustment: "Adjustment (+ adds, - removes)",
    reasonNote: "Reason / note",
    inPh: "e.g. 12",
    adjPh: "e.g. -2 for breakage",
    inReasonPh: "Supplier delivery #…",
    adjReasonPh: "Breakage, loss, recount…",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    needQty: "Qty must be a non-zero number",
    in: "in",
    sale: "sale",
    void: "void",
  },
} as const;

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

type Tr = Record<keyof (typeof STR)["en"], string>;

export default function InventoryClient({
  products,
  movements,
  currency,
}: {
  products: PosProduct[];
  movements: StockMovement[];
  currency: string;
}) {
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  const [adjOpen, setAdjOpen] = useState<PosProduct | null>(null);

  const lowStock = useMemo(
    () => products.filter((p) => p.active && p.stock <= p.low_stock_threshold),
    [products],
  );

  const productName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.name);
    return m;
  }, [products]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <p className="text-sm text-[var(--app-fg-muted)]">{tr.sub}</p>
      </div>

      <div className="space-y-5">
        {/* Low-stock banner */}
        {lowStock.length > 0 && (
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "color-mix(in srgb, #f59e0b 12%, transparent)",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              color: "#b45309",
            }}
          >
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} />
              {tr.lowBannerOne} {lowStock.length} {tr.lowBannerItems}
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full px-2 py-1 text-xs font-medium"
                  style={
                    p.stock <= 0
                      ? {
                          background: "color-mix(in srgb, var(--app-danger) 15%, transparent)",
                          color: "var(--app-danger)",
                          border: "1px solid color-mix(in srgb, var(--app-danger) 40%, transparent)",
                        }
                      : {
                          background: "var(--app-surface)",
                          color: "#d97706",
                          border: "1px solid color-mix(in srgb, #f59e0b 40%, transparent)",
                        }
                  }
                >
                  {p.name} · {p.stock}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stock levels */}
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <div className="border-b border-[var(--app-border)] px-5 py-3">
            <h2 className="font-semibold">{tr.stockLevels}</h2>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={<Boxes size={22} />} title={tr.empty} hint={tr.emptyHint} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left text-xs font-medium text-[var(--app-fg-muted)]">
                    <th className="px-5 py-2 font-medium">{tr.product}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.onHand}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.lowAt}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.stockValue}</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const out = p.stock <= 0;
                    const low = !out && p.stock <= p.low_stock_threshold;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[var(--app-border)] last:border-0"
                      >
                        <td className="px-5 py-2.5 font-medium">{p.name}</td>
                        <td
                          className="px-3 py-2.5 text-right font-semibold tabular-nums"
                          style={{
                            color: out
                              ? "var(--app-danger)"
                              : low
                                ? "#d97706"
                                : undefined,
                          }}
                        >
                          {p.stock}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--app-fg-muted)]">
                          {p.low_stock_threshold}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--app-fg-muted)]">
                          {money(p.cost * p.stock)}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <button
                            onClick={() => setAdjOpen(p)}
                            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--app-accent)] hover:opacity-80"
                          >
                            <Plus size={13} /> {tr.adjust}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent movements */}
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <div className="border-b border-[var(--app-border)] px-5 py-3">
            <h2 className="font-semibold">{tr.movements}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-left text-xs font-medium text-[var(--app-fg-muted)]">
                  <th className="px-5 py-2 font-medium">{tr.when}</th>
                  <th className="px-3 py-2 font-medium">{tr.product}</th>
                  <th className="px-3 py-2 font-medium">{tr.type}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr.qty}</th>
                  <th className="px-5 py-2 font-medium">{tr.reason}</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[var(--app-fg-muted)]"
                    >
                      {tr.noMovements}
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--app-border)] last:border-0"
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        {(m.product_id && productName.get(m.product_id)) || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <MovementBadge type={m.type} tr={tr} />
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-medium tabular-nums"
                        style={{ color: m.qty < 0 ? "var(--app-danger)" : "#10b981" }}
                      >
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </td>
                      <td className="px-5 py-2.5 text-[var(--app-fg-muted)]">
                        {m.reason || ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {adjOpen && (
        <AdjustModal
          product={adjOpen}
          currency={currency}
          tr={tr}
          onClose={() => setAdjOpen(null)}
        />
      )}
    </div>
  );
}

function MovementBadge({ type, tr }: { type: StockMovement["type"]; tr: Tr }) {
  const styleByType: Record<StockMovement["type"], { bg: string; fg: string }> = {
    in: { bg: "color-mix(in srgb, #10b981 16%, transparent)", fg: "#10b981" },
    sale: { bg: "color-mix(in srgb, #3b82f6 16%, transparent)", fg: "#3b82f6" },
    adjustment: {
      bg: "color-mix(in srgb, var(--app-fg-muted) 16%, transparent)",
      fg: "var(--app-fg-muted)",
    },
    void: {
      bg: "color-mix(in srgb, var(--app-danger) 16%, transparent)",
      fg: "var(--app-danger)",
    },
  };
  const labelByType: Record<StockMovement["type"], string> = {
    in: tr.in,
    sale: tr.sale,
    adjustment: tr.adjust.toLowerCase(),
    void: tr.void,
  };
  const sx = styleByType[type];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: sx.bg, color: sx.fg }}
    >
      {labelByType[type]}
    </span>
  );
}

function AdjustModal({
  product,
  currency,
  tr,
  onClose,
}: {
  product: PosProduct;
  currency: string;
  tr: Tr;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [type, setType] = useState<"in" | "adjustment">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(qty);
    if (!n || Number.isNaN(n)) {
      toast.error(tr.needQty);
      return;
    }
    setSaving(true);
    const res = await adjustProductStock(product.id, type, n, reason || null);
    setSaving(false);
    if (res.ok) {
      toast.success(tr.saved);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const tab = (on: boolean) =>
    `rounded-lg py-2 text-sm font-medium transition ${
      on
        ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
        : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] hover:bg-[var(--app-surface-2)]"
    }`;

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`${tr.adjustTitle} — ${product.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tr.cancel}
          </Button>
          <Button onClick={save} loading={saving}>
            {tr.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--app-fg-muted)]">
          {tr.currentlyOnHand}:{" "}
          <strong className="text-[var(--app-fg)]">{product.stock}</strong>
          <span className="ml-2 text-xs">({currency})</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setType("in")} className={tab(type === "in")}>
            {tr.stockIn}
          </button>
          <button
            type="button"
            onClick={() => setType("adjustment")}
            className={tab(type === "adjustment")}
          >
            {tr.manualAdjust}
          </button>
        </div>

        <div>
          <label className={label}>
            {type === "in" ? tr.qtyReceived : tr.adjustment}
          </label>
          <input
            type="number"
            step={1}
            className={field}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={type === "in" ? tr.inPh : tr.adjPh}
            autoFocus
          />
        </div>

        <div>
          <label className={label}>{tr.reasonNote}</label>
          <input
            className={field}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === "in" ? tr.inReasonPh : tr.adjReasonPh}
          />
        </div>
      </div>
    </Modal>
  );
}
