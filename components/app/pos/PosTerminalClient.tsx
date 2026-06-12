"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { completeSale } from "@/app/app/pos/actions";
import type { PosProduct, PosCategory } from "@/lib/db/pos";
import type { Booking } from "@/lib/db/bookings";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    products: "สินค้า",
    allCategories: "ทั้งหมด",
    stock: "คงเหลือ",
    outOfStock: "หมดสต็อก",
    noProducts: "ยังไม่มีสินค้า",
    noProductsHint: "เพิ่มสินค้าได้ที่หน้าสินค้า",
    cart: "ตะกร้า",
    cartEmpty: "ยังไม่มีสินค้าในตะกร้า",
    payment: "วิธีชำระเงิน",
    cash: "เงินสด",
    transfer: "โอนเงิน",
    card: "บัตร",
    room: "คิดเข้าห้องพัก",
    chargeRoom: "เลือกห้อง/ผู้เข้าพัก",
    noInhouse: "ไม่มีผู้เข้าพักในขณะนี้",
    note: "หมายเหตุ",
    notePlaceholder: "หมายเหตุ (ถ้ามี)",
    total: "ยอดรวม",
    complete: "ทำรายการขาย",
    remove: "นำออก",
    needRoom: "เลือกห้องสำหรับคิดเงิน",
    sold: "ขายแล้ว",
  },
  en: {
    products: "Products",
    allCategories: "All",
    stock: "stock",
    outOfStock: "out of stock",
    noProducts: "No products yet",
    noProductsHint: "Add products on the Products page.",
    cart: "Cart",
    cartEmpty: "Cart is empty",
    payment: "Payment method",
    cash: "Cash",
    transfer: "Transfer",
    card: "Card",
    room: "Charge to room",
    chargeRoom: "Room / guest",
    noInhouse: "No in-house guests",
    note: "Note",
    notePlaceholder: "Note (optional)",
    total: "Total",
    complete: "Complete sale",
    remove: "Remove",
    needRoom: "Pick a room to charge",
    sold: "Sold",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";
const card = "app-surface rounded-2xl border border-[var(--app-border)]";

type Payment = "cash" | "transfer" | "card" | "room";

export default function PosTerminalClient({
  products,
  categories,
  inhouse,
  currency,
}: {
  products: PosProduct[];
  categories: PosCategory[];
  inhouse: Booking[];
  currency: string;
}) {
  const { locale } = useI18n();
  const s = STR[locale === "en" ? "en" : "th"];
  const toast = useToast();
  const router = useRouter();

  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  const [catId, setCatId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<Payment>("cash");
  const [bookingId, setBookingId] = useState<string>(inhouse[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleProducts = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .filter((p) => (catId == null ? true : p.category_id === catId)),
    [products, catId],
  );

  const productById = useMemo(() => {
    const m = new Map<string, PosProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = productById.get(id);
          if (!product) return null;
          return { product, qty, lineTotal: product.price * qty };
        })
        .filter((l): l is { product: PosProduct; qty: number; lineTotal: number } => l != null),
    [cart, productById],
  );

  const grandTotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines]);
  const cartEmpty = lines.length === 0;

  function addToCart(id: string) {
    setCart((cur) => ({ ...cur, [id]: (cur[id] ?? 0) + 1 }));
  }
  function setQty(id: string, qty: number) {
    setCart((cur) => {
      if (qty <= 0) {
        const { [id]: _drop, ...rest } = cur;
        return rest;
      }
      return { ...cur, [id]: qty };
    });
  }
  function removeLine(id: string) {
    setCart((cur) => {
      const { [id]: _drop, ...rest } = cur;
      return rest;
    });
  }

  async function submit() {
    if (cartEmpty) return;
    if (payment === "room" && !bookingId) return toast.error(s.needRoom);
    setSaving(true);
    const res = await completeSale(
      payment,
      payment === "room" ? bookingId : null,
      lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
      note.trim() || null,
    );
    setSaving(false);
    if (res.ok) {
      toast.success(`${res.data.code} · ${money(res.data.total)}`);
      setCart({});
      setNote("");
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* ── Left: product grid ─────────────────────────────────────────── */}
      <div className={`${card} p-4`}>
        {products.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={22} />}
            title={s.noProducts}
            hint={s.noProductsHint}
          />
        ) : (
          <>
            {/* category chips */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Chip on={catId == null} onClick={() => setCatId(null)}>
                {s.allCategories}
              </Chip>
              {categories.map((c) => (
                <Chip key={c.id} on={catId === c.id} onClick={() => setCatId(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>

            {/* product cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleProducts.map((p) => {
                const oos = p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p.id)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-left transition-colors hover:border-[var(--app-accent)]"
                  >
                    <span className="line-clamp-2 text-sm font-medium text-[var(--app-fg)]">
                      {p.name}
                    </span>
                    <span className="text-sm font-semibold text-[var(--app-accent)]">
                      {money(p.price)}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: oos ? "var(--app-danger)" : "var(--app-fg-muted)" }}
                    >
                      {oos ? s.outOfStock : `${s.stock}: ${p.stock}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Right: cart panel ──────────────────────────────────────────── */}
      <div className={`${card} sticky top-4 flex h-fit flex-col p-4`}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--app-fg)]">
          <ShoppingCart size={18} />
          {s.cart}
        </h2>

        {cartEmpty ? (
          <p className="py-6 text-center text-sm text-[var(--app-fg-muted)]">{s.cartEmpty}</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {lines.map((l) => (
              <li
                key={l.product.id}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--app-fg)]">
                      {l.product.name}
                    </p>
                    <p className="text-xs text-[var(--app-fg-muted)]">{money(l.product.price)}</p>
                  </div>
                  <button
                    onClick={() => removeLine(l.product.id)}
                    aria-label={s.remove}
                    className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-danger)]"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <StepBtn onClick={() => setQty(l.product.id, l.qty - 1)} ariaLabel="−">
                      <Minus size={14} />
                    </StepBtn>
                    <span className="w-7 text-center text-sm font-medium tabular-nums">
                      {l.qty}
                    </span>
                    <StepBtn onClick={() => setQty(l.product.id, l.qty + 1)} ariaLabel="+">
                      <Plus size={14} />
                    </StepBtn>
                  </div>
                  <span className="text-sm font-semibold text-[var(--app-fg)]">
                    {money(l.lineTotal)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* payment method */}
        <div className="mb-3">
          <label className={label}>{s.payment}</label>
          <select
            className={field}
            value={payment}
            onChange={(e) => setPayment(e.target.value as Payment)}
          >
            <option value="cash">{s.cash}</option>
            <option value="transfer">{s.transfer}</option>
            <option value="card">{s.card}</option>
            <option value="room">{s.room}</option>
          </select>
        </div>

        {/* charge-to-room */}
        {payment === "room" && (
          <div className="mb-3">
            <label className={label}>{s.chargeRoom}</label>
            {inhouse.length === 0 ? (
              <p className="text-sm text-[var(--app-fg-muted)]">{s.noInhouse}</p>
            ) : (
              <select
                className={field}
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              >
                {inhouse.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.guest_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* note */}
        <div className="mb-3">
          <label className={label}>{s.note}</label>
          <input
            className={field}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={s.notePlaceholder}
          />
        </div>

        {/* grand total */}
        <div className="mb-3 flex items-center justify-between border-t border-[var(--app-border)] pt-3">
          <span className="text-sm font-medium text-[var(--app-fg-muted)]">{s.total}</span>
          <span className="text-lg font-bold text-[var(--app-fg)]">{money(grandTotal)}</span>
        </div>

        <Button
          onClick={submit}
          loading={saving}
          disabled={cartEmpty}
          className="w-full"
        >
          {s.complete}
        </Button>
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        on
          ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
          : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function StepBtn({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--app-border)] text-[var(--app-fg)] transition-colors hover:bg-[var(--app-surface)]"
    >
      {children}
    </button>
  );
}
