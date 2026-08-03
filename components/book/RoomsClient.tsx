"use client";

import { useRouter } from "next/navigation";
import { BedDouble } from "lucide-react";
import type { AvailabilityRow } from "@/lib/book";
import Button from "@/components/app/ui/Button";

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
  rooms: (AvailabilityRow & { total: number })[];
  nights: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  currency: string;
}) {
  const router = useRouter();
  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  // A room type with no published rate quotes at 0. Selling it would write a
  // THB 0 booking straight into the PMS and the ledger, so it is shown as
  // "ask the property" rather than offered at zero.
  const sellable = (r: (typeof rooms)[number]) => r.available > 0 && r.total > 0;
  const anyAvailable = rooms.some(sellable);

  if (rooms.length === 0 || !anyAvailable) {
    // Rooms with space but no rate are a setup gap, not a sold-out hotel —
    // saying "no rooms" would send the guest away and hide the real cause.
    const hasUnpricedSpace = rooms.some((r) => r.available > 0 && r.total <= 0);
    return (
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 text-center">
        <BedDouble size={24} className="mx-auto text-[var(--app-fg-muted)]" />
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          {hasUnpricedSpace
            ? "ยังไม่ได้ประกาศราคาสำหรับช่วงวันที่นี้ กรุณาติดต่อที่พักโดยตรง / No rates published for these dates — please contact the property directly."
            : "ไม่มีห้องว่างในช่วงวันที่นี้ / No rooms available for these dates."}
        </p>
      </div>
    );
  }

  function book(roomTypeId: string) {
    router.push(
      `/book/${code}/checkout?type=${roomTypeId}&check_in=${checkIn}&check_out=${checkOut}&adults=${adults}&children=${childrenCount}`
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((r) => {
        const soldOut = r.available <= 0;
        const unpriced = !soldOut && r.total <= 0;
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
                {!soldOut &&
                  (unpriced ? (
                    <div className="text-sm text-[var(--app-fg-muted)]">
                      สอบถามราคา / Rate on request
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold">{money(r.total)}</div>
                      <div className="text-xs text-[var(--app-fg-muted)]">
                        ≈ {money(r.total / nights)} /คืน / night
                      </div>
                    </>
                  ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => book(r.room_type_id)} disabled={soldOut || unpriced}>
                จอง / Book
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
