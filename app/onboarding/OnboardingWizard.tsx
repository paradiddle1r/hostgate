"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { provisionTenant, type PropertyType } from "./actions";
import RoomGenerator from "@/components/app/rooms/RoomGenerator";

// Streamlined onboarding — 3 steps, and the calendar is ready when it's done:
//   1. Property      — name + type + city + currency
//   2. Room types    — name + nightly rate (the per-room "quantity" used to be
//                      asked here too; it's now derived from step 3, no dup)
//   3. Rooms         — the SAME floor generator + bulk type-assignment grid the
//                      app uses, so real rooms exist and the calendar works.
// provisionTenant creates tenant + member + property + room types + rooms.

type Locale = "th" | "en";
type Step = 1 | 2 | 3;
interface TypeRow { name: string; rate: number | "" }

const STR: Record<Locale, Record<string, string>> = {
  th: {
    s1Title: "ข้อมูลที่พัก", s1Sub: "เริ่มจากชื่อและประเภทที่พักของคุณ",
    name: "ชื่อที่พัก", namePh: "เช่น โรงแรมสุขุมวิท",
    type: "ประเภท", daily: "รายวัน", monthly: "รายเดือน", both: "ทั้งสองแบบ",
    city: "เมือง / จังหวัด", currency: "สกุลเงิน",
    s2Title: "ประเภทห้องพัก", s2Sub: "ตั้งชื่อประเภทห้องและราคาต่อคืน (เพิ่มได้หลายแบบ)",
    typeName: "ชื่อประเภท", rate: "ราคา/คืน", addType: "เพิ่มประเภท",
    s3Title: "สร้างห้องพัก", s3Sub: "กำหนดชั้นและจำนวนห้อง ระบบจะสร้างเลขห้องให้ แล้วเลือกประเภทแต่ละห้อง — เสร็จแล้วปฏิทินพร้อมใช้ทันที",
    next: "ถัดไป", back: "ย้อนกลับ", finishing: "กำลังสร้าง…",
    errName: "กรุณากรอกชื่อที่พัก", errType: "กรุณาเพิ่มประเภทห้องอย่างน้อย 1 ประเภท",
    errFail: "สร้างบัญชีไม่สำเร็จ", stepOf: "ขั้นที่ {n} จาก 3",
  },
  en: {
    s1Title: "Your property", s1Sub: "Start with your property's name and type.",
    name: "Property name", namePh: "e.g. Sukhumvit Inn",
    type: "Type", daily: "Daily", monthly: "Monthly", both: "Both",
    city: "City / province", currency: "Currency",
    s2Title: "Room types", s2Sub: "Name each room type and its nightly rate (add as many as you need).",
    typeName: "Type name", rate: "Rate/night", addType: "Add type",
    s3Title: "Create your rooms", s3Sub: "Set floors + rooms per floor, we generate the room numbers, then pick a type per room — when you're done the calendar is ready.",
    next: "Continue", back: "Back", finishing: "Creating…",
    errName: "Please enter a property name", errType: "Add at least one room type",
    errFail: "Couldn't create your account", stepOf: "Step {n} of 3",
  },
};

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#0a84ff]";
const label = "mb-1 block text-xs font-medium text-zinc-500";

export default function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const { locale: rawLocale } = useI18n();
  const locale: Locale = rawLocale === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(1);
  const [propertyType, setPropertyType] = useState<PropertyType>("daily");
  const [propertyName, setPropertyName] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [types, setTypes] = useState<TypeRow[]>([
    { name: "Standard", rate: 900 },
    { name: "Deluxe", rate: 1200 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const validTypes = types.filter((t) => t.name.trim().length > 0);

  function next() {
    setError(null);
    if (step === 1) {
      if (!propertyName.trim()) return setError(s("errName"));
      setStep(2);
    } else if (step === 2) {
      if (validTypes.length === 0) return setError(s("errType"));
      setStep(3);
    }
  }

  // Step 3 → finish. The generator hands us the rooms; we map each room's
  // assigned type (an index string) back to a numeric index for provisioning.
  function finish(rows: { number: string; floor: number; room_type_id: string | null; sort_order: number }[]): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await provisionTenant({
          property_name: propertyName.trim(),
          property_type: propertyType,
          city: city.trim() || undefined,
          currency,
          room_types: validTypes.map((t) => ({ name: t.name.trim(), rate: Number(t.rate) || 0 })),
          rooms: rows.map((r) => ({
            number: r.number,
            floor: r.floor,
            type_index: r.room_type_id != null ? Number(r.room_type_id) : null,
            sort_order: r.sort_order,
          })),
        });
        if (!res.ok) {
          setError(`${s("errFail")} — ${res.error}`);
          resolve(false);
          return;
        }
        router.push("/app/calendar");
        resolve(true);
      });
    });
  }

  // id = index within validTypes — the same array order sent to provisionTenant,
  // so a room's assigned id maps straight to its room_types[] entry.
  const typeOptions = validTypes.map((t, i) => ({ id: String(i), name: t.name.trim() }));

  return (
    <div data-theme="light" className="w-full max-w-2xl">
      {/* progress */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="font-medium uppercase tracking-wider">{s("stepOf").replace("{n}", String(step))}</span>
        <span className="truncate">{userEmail}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full bg-[#0a84ff] transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200/60 bg-white/85 p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-9">
        {/* ── Step 1: property ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{s("s1Title")}</h2>
            <p className="mt-1 text-sm text-zinc-500">{s("s1Sub")}</p>
            <div className="mt-6 space-y-4">
              <div>
                <span className={label}>{s("name")}</span>
                <input className={input} value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder={s("namePh")} autoFocus />
              </div>
              <div>
                <span className={label}>{s("type")}</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["daily", "monthly", "both"] as PropertyType[]).map((pt) => (
                    <button key={pt} type="button" onClick={() => setPropertyType(pt)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        propertyType === pt
                          ? "border-[#0a84ff] bg-[#0a84ff]/10 text-[#0a84ff]"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400"
                      }`}>
                      {s(pt)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>{s("city")}</span>
                  <input className={input} value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <span className={label}>{s("currency")}</span>
                  <input className={input} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: room types ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{s("s2Title")}</h2>
            <p className="mt-1 text-sm text-zinc-500">{s("s2Sub")}</p>
            <div className="mt-6 space-y-2">
              <div className="flex gap-2 px-1 text-xs font-medium text-zinc-400">
                <span className="flex-1">{s("typeName")}</span>
                <span className="w-28">{s("rate")}</span>
                <span className="w-7" />
              </div>
              {types.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={`${input} flex-1`} value={row.name}
                    onChange={(e) => setTypes((cur) => cur.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} />
                  <input type="number" min={0} className={`${input} w-28`} value={row.rate}
                    onChange={(e) => setTypes((cur) => cur.map((r, idx) => (idx === i ? { ...r, rate: e.target.value === "" ? "" : Number(e.target.value) } : r)))} />
                  <button type="button" aria-label="remove"
                    onClick={() => setTypes((cur) => cur.filter((_, idx) => idx !== i))}
                    className="grid h-7 w-7 flex-none place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setTypes((cur) => [...cur, { name: "", rate: "" }])}
                className="mt-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-[#0a84ff] hover:text-[#0a84ff]">
                + {s("addType")}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: rooms (the real generator) ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{s("s3Title")}</h2>
            <p className="mt-1 mb-5 text-sm text-zinc-500">{s("s3Sub")}</p>
            <RoomGenerator roomTypes={typeOptions} onSave={finish} showTitle={false} />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {/* footer nav — hidden on step 3 (the generator's own Save button finishes) */}
        {step < 3 && (
          <div className="mt-7 flex items-center justify-between">
            <button type="button" onClick={() => setStep((st) => (st === 2 ? 1 : st))}
              className={`text-sm font-medium text-zinc-500 hover:text-zinc-700 ${step === 1 ? "invisible" : ""}`}>
              ← {s("back")}
            </button>
            <button type="button" onClick={next} disabled={pending}
              className="rounded-xl bg-[#0a84ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a78e6] disabled:opacity-60">
              {s("next")} →
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="mt-5">
            <button type="button" onClick={() => setStep(2)} className="text-sm font-medium text-zinc-500 hover:text-zinc-700">← {s("back")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
