"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble } from "lucide-react";
import type { AvailabilityRow } from "@/lib/book";
import Button from "@/components/app/ui/Button";

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

  function book(roomTypeId: string, planId?: string) {
    const qs = new URLSearchParams({
      type: roomTypeId,
      check_in: checkIn,
      check_out: checkOut,
      adults: String(adults),
      children: String(childrenCount),
    });
    if (planId) qs.set("plan", planId);
    router.push(`/book/${code}/checkout?${qs.toString()}`);
  }

  return (
    <div className="space-y-3">
      {rooms.map((r) => {
        const soldOut = r.available <= 0;
        const hasPlans = r.planOptions.length > 0;
        const activePlanId = selectedPlan[r.room_type_id] ?? r.planOptions[0]?.id;
        const activePlan = r.planOptions.find((p) => p.id === activePlanId) ?? null;
        const shownTotal = activePlan ? activePlan.total : r.total;

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

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => book(r.room_type_id, activePlan?.id)}
                disabled={soldOut}
              >
                จอง / Book
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
