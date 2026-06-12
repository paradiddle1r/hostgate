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

  function book(roomTypeId: string) {
    router.push(
      `/book/${code}/checkout?type=${roomTypeId}&check_in=${checkIn}&check_out=${checkOut}&adults=${adults}&children=${childrenCount}`
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((r) => {
        const soldOut = r.available <= 0;
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
                    <div className="font-semibold">{money(r.total)}</div>
                    <div className="text-xs text-[var(--app-fg-muted)]">
                      ≈ {money(r.total / nights)} /คืน / night
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => book(r.room_type_id)} disabled={soldOut}>
                จอง / Book
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
