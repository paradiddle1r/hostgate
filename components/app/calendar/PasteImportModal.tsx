"use client";

import { useMemo, useState } from "react";
import { CalendarRange, User, Phone, Hash, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import { parseBookingText } from "@/lib/booking-parse";

// Known OTA / source names to recognize in pasted confirmation text. Kept in
// sync with the BookingModal OTA <select> options.
const OTA_NAMES: { match: RegExp; name: string }[] = [
  { match: /agoda/i, name: "Agoda" },
  { match: /booking\.?com/i, name: "Booking.com" },
  { match: /expedia/i, name: "Expedia" },
  { match: /airbnb/i, name: "Airbnb" },
  { match: /traveloka/i, name: "Traveloka" },
  { match: /trip\.?com/i, name: "Trip.com" },
];

/** Detect the OTA/source from the pasted text, else undefined. */
function detectOta(text: string): string | undefined {
  for (const o of OTA_NAMES) if (o.match.test(text)) return o.name;
  return undefined;
}

/**
 * Pull a reservation/booking number. Prefers a labelled line
 * ("Reservation no: 12345", "Booking ID: ABC-123", "เลขที่จอง: ..."), else
 * undefined. Conservative — avoids phone numbers and dates.
 */
function detectReservationNo(text: string): string | undefined {
  const m = text.match(
    /(?:reservation\s*(?:no|number|id)?|booking\s*(?:no|number|id)|confirmation\s*(?:no|number|code)|itinerary|เลขที่จอง|หมายเลขการจอง)\s*[#:：]?\s*([A-Za-z0-9][A-Za-z0-9-]{3,})/i
  );
  if (m) {
    const v = m[1].trim();
    if (v.length >= 4 && v.length <= 32) return v;
  }
  return undefined;
}

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "วางข้อความการจอง",
    hint: "วางข้อความยืนยันการจองจาก Agoda / Booking.com / อีเมล แล้วระบบจะดึงวันที่ ชื่อ และเบอร์โทรให้",
    placeholder: "วางข้อความที่นี่…",
    found: "ดึงข้อมูลได้",
    nothing: "ยังไม่พบวันที่ — วางข้อความที่มีวันเข้าพักและวันออก",
    checkIn: "วันเข้า",
    checkOut: "วันออก",
    guest: "ชื่อผู้เข้าพัก",
    phone: "โทรศัพท์",
    ota: "ช่องทาง",
    resNo: "เลขที่จอง",
    use: "ใช้ข้อมูลนี้",
    cancel: "ยกเลิก",
  },
  en: {
    title: "Paste booking text",
    hint: "Paste a confirmation from Agoda / Booking.com / email — we'll pull out the dates, name and phone.",
    placeholder: "Paste here…",
    found: "Extracted",
    nothing: "No dates found yet — paste text that includes a check-in and check-out date.",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guest: "Guest name",
    phone: "Phone",
    ota: "Source",
    resNo: "Reservation no.",
    use: "Use these details",
    cancel: "Cancel",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";

export default function PasteImportModal({
  onClose,
  onSeed,
}: {
  onClose: () => void;
  onSeed: (seed: {
    checkIn?: string;
    checkOut?: string;
    guestName?: string;
    phone?: string;
    ota?: string;
    reservationNo?: string;
  }) => void;
}) {
  const { locale: raw } = useI18n();
  const s = STR[raw === "en" ? "en" : "th"];
  const [text, setText] = useState("");
  // parseBookingText covers dates/name/phone; OTA + reservation no. are
  // extracted here (the shared parser lib isn't in this domain's files).
  const parsed = useMemo(() => {
    const base = parseBookingText(text);
    return { ...base, ota: detectOta(text), reservationNo: detectReservationNo(text) };
  }, [text]);
  const usable = !!parsed.checkIn;

  return (
    <Modal
      open
      onClose={onClose}
      title={s.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button disabled={!usable} onClick={() => onSeed(parsed)}>
            {s.use}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--app-fg-muted)]">{s.hint}</p>
        <textarea
          autoFocus
          className={`${field} min-h-[140px] resize-y font-mono text-[13px]`}
          placeholder={s.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {text.trim() && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
            {usable ? (
              <>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
                  {s.found}
                </div>
                <div className="grid gap-1.5 text-sm">
                  <Row icon={<CalendarRange size={14} />}>
                    {s.checkIn}: <b>{parsed.checkIn}</b>
                    {parsed.checkOut && (
                      <>
                        {"  →  "}
                        {s.checkOut}: <b>{parsed.checkOut}</b>
                      </>
                    )}
                  </Row>
                  {parsed.guestName && (
                    <Row icon={<User size={14} />}>
                      {s.guest}: <b>{parsed.guestName}</b>
                    </Row>
                  )}
                  {parsed.phone && (
                    <Row icon={<Phone size={14} />}>
                      {s.phone}: <b>{parsed.phone}</b>
                    </Row>
                  )}
                  {parsed.ota && (
                    <Row icon={<Globe size={14} />}>
                      {s.ota}: <b>{parsed.ota}</b>
                    </Row>
                  )}
                  {parsed.reservationNo && (
                    <Row icon={<Hash size={14} />}>
                      {s.resNo}: <b>{parsed.reservationNo}</b>
                    </Row>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--app-fg-muted)]">{s.nothing}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--app-accent)]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
