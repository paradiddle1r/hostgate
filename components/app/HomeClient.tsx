"use client";

import Link from "next/link";
import { CalendarDays, Users, BedDouble, ArrowRight } from "lucide-react";
import { useAppT } from "@/lib/app-i18n";

export default function HomeClient({
  propertyName,
  counts,
}: {
  propertyName: string;
  counts: { rooms: number; guests: number; arrivals: number };
}) {
  const t = useAppT();

  const stats = [
    { label: t("home.rooms"), value: counts.rooms, icon: BedDouble },
    { label: t("home.guests"), value: counts.guests, icon: Users },
    { label: t("home.bookingsToday"), value: counts.arrivals, icon: CalendarDays },
  ];

  const links = [
    { href: "/app/calendar", label: t("home.quickCalendar"), icon: CalendarDays },
    { href: "/app/rooms", label: t("home.quickRooms"), icon: BedDouble },
    { href: "/app/guests", label: t("home.quickGuests"), icon: Users },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-[var(--app-fg-muted)]">{t("home.welcome")}</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{propertyName}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <Icon size={18} className="text-[var(--app-accent)]" />
            <div className="mt-3 text-3xl font-semibold">{value}</div>
            <div className="text-sm text-[var(--app-fg-muted)]">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="app-surface flex items-center gap-3 rounded-2xl border border-[var(--app-border)] p-4 transition hover:border-[var(--app-accent)]"
          >
            <Icon size={18} />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ArrowRight size={16} className="text-[var(--app-fg-muted)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
