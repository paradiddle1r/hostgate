"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { AvailabilityRow } from "@/lib/book";
import Button from "@/components/app/ui/Button";
import {
  type CartLineItem,
  type StoredCart,
  loadCart,
  saveCart,
  emptyCart,
  addCartLine,
  removeCartLine,
  cartItemCount,
  buildCheckoutUrl,
} from "@/lib/book-cart";

export interface RoomPlanOption {
  id: string;
  name: string;
  color: string;
  description: string | null;
  nightly: number;
  total: number;
}

export default function RoomsClient({
  code,
  rooms,
  nights,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  currency,
}: {
  code: string;
  rooms: (AvailabilityRow & { total: number; planOptions: RoomPlanOption[] })[];
  nights: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  currency: string;
}) {
  const router = useRouter();
  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  // Selected plan per room type, defaulting to the first (sort_order-lowest,
  // i.e. the property's standard/base plan) when any exist.
  const [selectedPlan, setSelectedPlan] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const r of rooms) if (r.planOptions.length > 0) init[r.room_type_id] = r.planOptions[0].id;
    return init;
  });
  const [qty, setQty] = useState<Record<string, number>>({});

  // Cart is IDENTIFIERS ONLY (room_type_id, plan id, quantity) — see
  // lib/book-cart.ts. It's kept in sessionStorage scoped to this property
  // code so it survives navigation within the rooms page, but reset
  // whenever the shared date range / occupancy of the current search
  // differs from what's stored (a stale cart from a different search would
  // otherwise silently mix date ranges, which is out of scope — dates are
  // shared across the whole cart).
  const [cart, setCart] = useState<StoredCart>(() => emptyCart(checkIn, checkOut, adults, childrenCount));

  useEffect(() => {
    const stored = loadCart(code);
    if (stored && stored.checkIn === checkIn && stored.checkOut === checkOut && stored.adults === adults && stored.children === childrenCount) {
      setCart(stored);
    } else {
      const fresh = emptyCart(checkIn, checkOut, adults, childrenCount);
      setCart(fresh);
      saveCart(code, fresh);
    }
    // Only re-run when the search itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, checkIn, checkOut, adults, childrenCount]);

  const roomsById = useMemo(() => {
    const m: Record<string, (typeof rooms)[number]> = {};
    for (const r of rooms) m[r.room_type_id] = r;
    return m;
  }, [rooms]);

  const planById = useMemo(() => {
    const m: Record<string, RoomPlanOption> = {};
    for (const r of rooms) for (const p of r.planOptions) m[p.id] = p;
    return m;
  }, [rooms]);

  const cartCount = cartItemCount(cart);
  const cartTotal = cart.items.reduce((sum, line) => {
    const room = roomsById[line.roomTypeId];
    if (!room) return sum;
    const plan = line.planId ? planById[line.planId] : null;
    const unitTotal = plan ? plan.total : room.total;
    return sum + unitTotal * line.qty;
  }, 0);

  const anyAvailable = rooms.some((r) => r.available > 0);

  if (rooms.length === 0 || !anyAvailable) {
    return (
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 text-center">
        <BedDouble size={24} className="mx-auto text-[var(--app-fg-muted)]" />
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          ไม่มีห้องว่างในช่วงวันที่นี้ / No rooms available for these dates.
        </p>
      </div>
    );
  }

  function currentQty(roomTypeId: string, available: number): number {
    return Math.max(1, Math.min(available, qty[roomTypeId] ?? 1));
  }

  function setRoomQty(roomTypeId: string, available: number, next: number) {
    setQty((q) => ({ ...q, [roomTypeId]: Math.max(1, Math.min(available, next)) }));
  }

  function addToCart(roomTypeId: string, available: number, planId: string | null) {
    const n = currentQty(roomTypeId, available);
    const line: CartLineItem = { roomTypeId, planId, qty: n };
    const next = addCartLine(cart, line);
    setCart(next);
    saveCart(code, next);
  }

  function removeFromCart(roomTypeId: string, planId: string | null) {
    const next = removeCartLine(cart, roomTypeId, planId);
    setCart(next);
    saveCart(code, next);
  }

  function proceedToCheckout() {
    router.push(buildCheckoutUrl(code, cart));
  }

  return (
    <div className="space-y-3 pb-24">
      {rooms.map((r) => {
        const soldOut = r.available <= 0;
        const hasPlans = r.planOptions.length > 0;
        const activePlanId = selectedPlan[r.room_type_id] ?? r.planOptions[0]?.id;
        const activePlan = r.planOptions.find((p) => p.id === activePlanId) ?? null;
        const shownTotal = activePlan ? activePlan.total : r.total;
        const n = currentQty(r.room_type_id, r.available);
        const inCartQty = cart.items
          .filter((i) => i.roomTypeId === r.room_type_id)
          .reduce((sum, i) => sum + i.qty, 0);

        return (
          <div
            key={r.room_type_id}
            className="app-surface rounded-2xl border border-[var(--app-border)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{r.name}</div>
                {soldOut ? (
                  <div className="mt-0.5 text-sm font-medium text-[var(--app-danger)]">
                    เต็ม / Sold out
                  </div>
                ) : (
                  <div className="mt-0.5 text-sm text-[var(--app-fg-muted)]">
                    ว่าง {r.available} ห้อง / {r.available} left
                    {inCartQty > 0 && (
                      <span className="ml-1.5 text-[var(--app-accent)]">
                        · {inCartQty} ในตะกร้า / in cart
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-right">
                {!soldOut && (
                  <>
                    <div className="font-semibold">{money(shownTotal)}</div>
                    <div className="text-xs text-[var(--app-fg-muted)]">
                      ≈ {money(shownTotal / nights)} /คืน / night
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Rate-plan picker — only shown when the property has 2+ active
                plans for this room type; a single plan (or none) is applied
                silently and just shows its price above. */}
            {!soldOut && hasPlans && r.planOptions.length > 1 && (
              <div className="mt-3 space-y-1.5 border-t border-[var(--app-border)] pt-3">
                <div className="text-xs font-medium text-[var(--app-fg-muted)]">
                  แผนราคา / Rate plan
                </div>
                {r.planOptions.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-sm has-[:checked]:border-[var(--app-accent)]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="radio"
                        name={`plan-${r.room_type_id}`}
                        checked={activePlanId === p.id}
                        onChange={() =>
                          setSelectedPlan((s) => ({ ...s, [r.room_type_id]: p.id }))
                        }
                      />
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="flex-none text-xs text-[var(--app-fg-muted)]">
                      {money(p.total)} · {money(p.nightly)}/คืน
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3">
              {!soldOut && (
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-1.5 py-1">
                  <button
                    type="button"
                    aria-label="ลดจำนวน / decrease quantity"
                    onClick={() => setRoomQty(r.room_type_id, r.available, n - 1)}
                    disabled={n <= 1}
                    className="grid h-6 w-6 place-items-center rounded-md hover:bg-[var(--app-surface-2)] disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center text-sm tabular-nums">{n}</span>
                  <button
                    type="button"
                    aria-label="เพิ่มจำนวน / increase quantity"
                    onClick={() => setRoomQty(r.room_type_id, r.available, n + 1)}
                    disabled={n >= r.available}
                    className="grid h-6 w-6 place-items-center rounded-md hover:bg-[var(--app-surface-2)] disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
              <Button
                onClick={() => addToCart(r.room_type_id, r.available, activePlan?.id ?? null)}
                disabled={soldOut}
              >
                เพิ่มลงตะกร้า / Add to cart
              </Button>
            </div>
          </div>
        );
      })}

      {/* Persistent cart summary bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {/* Line items, so a guest can review/remove before checkout */}
            <div className="mb-2 max-h-32 space-y-1 overflow-y-auto text-sm">
              {cart.items.map((line) => {
                const room = roomsById[line.roomTypeId];
                const plan = line.planId ? planById[line.planId] : null;
                const unitTotal = plan ? plan.total : room?.total ?? 0;
                return (
                  <div
                    key={`${line.roomTypeId}:${line.planId ?? ""}`}
                    className="flex items-center justify-between gap-2 text-[var(--app-fg-muted)]"
                  >
                    <span className="truncate">
                      {room?.name ?? "Room"}
                      {plan ? ` · ${plan.name}` : ""} × {line.qty}
                    </span>
                    <span className="flex flex-none items-center gap-2">
                      <span className="text-[var(--app-fg)]">{money(unitTotal * line.qty)}</span>
                      <button
                        type="button"
                        aria-label="ลบออกจากตะกร้า / remove from cart"
                        onClick={() => removeFromCart(line.roomTypeId, line.planId)}
                        className="grid h-5 w-5 place-items-center rounded-md hover:bg-[var(--app-surface-2)]"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2">
              <div className="flex items-center gap-2 text-sm">
                <ShoppingCart size={16} className="text-[var(--app-accent)]" />
                <span>
                  {cartCount} ห้อง / {cartCount} {cartCount === 1 ? "room" : "rooms"} ·{" "}
                  <span className="font-semibold text-[var(--app-fg)]">{money(cartTotal)}</span>
                </span>
                <span className="hidden text-xs text-[var(--app-fg-muted)] sm:inline">
                  (ราคาสุดท้ายคำนวณใหม่ตอนชำระเงิน / final price recomputed at checkout)
                </span>
              </div>
              <Button onClick={proceedToCheckout}>ไปชำระเงิน / Proceed to checkout</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
