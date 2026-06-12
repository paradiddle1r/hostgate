"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, Search } from "lucide-react";
import Button from "@/components/app/ui/Button";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function BookSearchForm({
  code,
  defaultCheckIn,
  defaultCheckOut,
}: {
  code: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState("");

  function search() {
    setError("");
    if (!checkIn || !checkOut) {
      setError("กรุณาเลือกวันที่ / Please choose dates.");
      return;
    }
    if (checkOut <= checkIn) {
      setError("วันที่ออกต้องหลังวันที่เข้าพัก / Check-out must be after check-in.");
      return;
    }
    const a = Math.max(1, Number(adults) || 1);
    const c = Math.max(0, Number(children) || 0);
    router.push(
      `/book/${code}/rooms?check_in=${checkIn}&check_out=${checkOut}&adults=${a}&children=${c}`
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <h1 className="text-lg font-semibold tracking-tight">จองห้องพัก / Book your stay</h1>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">
          เลือกวันที่และจำนวนผู้เข้าพัก / Pick your dates and guests.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--app-fg-muted)]">
              <CalendarDays size={13} /> เข้าพัก / Check-in
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--app-fg-muted)]">
              <CalendarDays size={13} /> ออก / Check-out
            </span>
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--app-fg-muted)]">
              <Users size={13} /> ผู้ใหญ่ / Adults
            </span>
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--app-fg-muted)]">
              <Users size={13} /> เด็ก / Children
            </span>
            <input
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
              className={`${field} w-full`}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}

        <Button onClick={search} className="mt-4 w-full">
          <Search size={16} /> ค้นหาห้องว่าง / Search rooms
        </Button>
      </div>
    </div>
  );
}
