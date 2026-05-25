"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, pick } from "@/lib/i18n";
import { provisionTenant, type PropertyType, type RoomTypeInput, type StayKind } from "./actions";

type Step = 1 | 2 | 3;

interface RoomRow {
  name: string;
  quantity: number | "";
  stay_kind: StayKind;
}

const defaultRoomsFor = (pt: PropertyType): RoomRow[] => {
  if (pt === "monthly") return [{ name: "Studio", quantity: 10, stay_kind: "monthly" }];
  if (pt === "both")
    return [
      { name: "Standard", quantity: 8, stay_kind: "daily" },
      { name: "Studio", quantity: 6, stay_kind: "monthly" },
    ];
  return [
    { name: "Standard", quantity: 8, stay_kind: "daily" },
    { name: "Deluxe", quantity: 4, stay_kind: "daily" },
  ];
};

export default function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(1);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("TH");
  const [currency, setCurrency] = useState("THB");
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stepLabel = pick(t.onboarding.stepLabel, locale).replace("{n}", String(step));

  /* ---------- step 1 ---------- */
  const choose = (pt: PropertyType) => {
    setPropertyType(pt);
    setRooms(defaultRoomsFor(pt));
    setStep(2);
  };

  /* ---------- step 3 helpers ---------- */
  const addRoom = () =>
    setRooms((r) => [
      ...r,
      { name: "", quantity: 1, stay_kind: propertyType === "monthly" ? "monthly" : "daily" },
    ]);
  const updateRoom = (i: number, patch: Partial<RoomRow>) =>
    setRooms((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRoom = (i: number) => setRooms((r) => r.filter((_, idx) => idx !== i));

  /* ---------- final submit ---------- */
  const onFinish = () => {
    if (!propertyType) return;
    const validRooms: RoomTypeInput[] = rooms
      .map((r) => ({
        name: r.name.trim(),
        quantity: typeof r.quantity === "number" ? r.quantity : 0,
        stay_kind: r.stay_kind,
      }))
      .filter((r) => r.name.length > 0 && r.quantity > 0);
    if (validRooms.length === 0) {
      setError(pick(t.onboarding.step3.empty, locale));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await provisionTenant({
        property_name: propertyName.trim(),
        property_type: propertyType,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        country,
        currency,
        room_types: validRooms,
      });
      if (!res.ok) {
        // Surface the real error message — important for debugging RLS / auth issues.
        setError(`${pick(t.onboarding.error, locale)} — ${res.error}`);
        return;
      }
      router.push("/app");
    });
  };

  return (
    <div className="w-full max-w-2xl">
      <Header step={step} totalSteps={3} label={stepLabel} userEmail={userEmail} />

      <div className="mt-6 rounded-2xl border border-zinc-200/60 bg-white/80 p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-9">
        {step === 1 && (
          <Step1
            choose={choose}
            current={propertyType}
            tStep={t.onboarding.step1}
            locale={locale}
          />
        )}
        {step === 2 && (
          <Step2
            tStep={t.onboarding.step2}
            locale={locale}
            propertyName={propertyName}
            setPropertyName={setPropertyName}
            address={address}
            setAddress={setAddress}
            city={city}
            setCity={setCity}
            country={country}
            setCountry={setCountry}
            currency={currency}
            setCurrency={setCurrency}
          />
        )}
        {step === 3 && propertyType && (
          <Step3
            propertyType={propertyType}
            tStep={t.onboarding.step3}
            locale={locale}
            rooms={rooms}
            addRoom={addRoom}
            updateRoom={updateRoom}
            removeRoom={removeRoom}
          />
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <Footer
          step={step}
          setStep={setStep}
          canContinue={
            step === 1
              ? propertyType !== null
              : step === 2
              ? propertyName.trim().length > 0
              : rooms.some((r) => r.name.trim() && typeof r.quantity === "number" && r.quantity > 0)
          }
          onFinish={onFinish}
          pending={pending}
          locale={locale}
          t={t}
        />
      </div>
    </div>
  );
}

/* ====================================================================== */

function Header({
  step,
  totalSteps,
  label,
  userEmail,
}: {
  step: Step;
  totalSteps: number;
  label: string;
  userEmail: string;
}) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="font-medium uppercase tracking-wider">{label}</span>
        <span className="truncate">{userEmail}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Step 1 ---------- */

function Step1({
  choose,
  current,
  tStep,
  locale,
}: {
  choose: (pt: PropertyType) => void;
  current: PropertyType | null;
  tStep: typeof import("@/lib/i18n").translations.onboarding.step1;
  locale: "th" | "en";
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {pick(tStep.title, locale)}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{pick(tStep.subtitle, locale)}</p>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ChoiceCard
          active={current === "daily"}
          icon={<BedIcon />}
          title={pick(tStep.daily.title, locale)}
          desc={pick(tStep.daily.desc, locale)}
          onClick={() => choose("daily")}
        />
        <ChoiceCard
          active={current === "monthly"}
          icon={<BuildingIcon />}
          title={pick(tStep.monthly.title, locale)}
          desc={pick(tStep.monthly.desc, locale)}
          onClick={() => choose("monthly")}
        />
        <ChoiceCard
          active={current === "both"}
          icon={<MixedIcon />}
          title={pick(tStep.both.title, locale)}
          desc={pick(tStep.both.desc, locale)}
          onClick={() => choose("both")}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition ${
        active
          ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/15"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
        {icon}
      </span>
      <div>
        <div className="text-base font-semibold text-zinc-900">{title}</div>
        <div className="mt-0.5 text-xs text-zinc-500">{desc}</div>
      </div>
    </button>
  );
}

/* ---------- Step 2 ---------- */

function Step2({
  tStep,
  locale,
  propertyName,
  setPropertyName,
  address,
  setAddress,
  city,
  setCity,
  country,
  setCountry,
  currency,
  setCurrency,
}: {
  tStep: typeof import("@/lib/i18n").translations.onboarding.step2;
  locale: "th" | "en";
  propertyName: string;
  setPropertyName: (s: string) => void;
  address: string;
  setAddress: (s: string) => void;
  city: string;
  setCity: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  currency: string;
  setCurrency: (s: string) => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {pick(tStep.title, locale)}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{pick(tStep.subtitle, locale)}</p>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={pick(tStep.propertyName, locale)} className="sm:col-span-2">
          <input
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder={pick(tStep.propertyNamePh, locale)}
            className={inputCls}
          />
        </Field>
        <Field label={pick(tStep.address, locale)} className="sm:col-span-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={pick(tStep.addressPh, locale)}
            className={inputCls}
          />
        </Field>
        <Field label={pick(tStep.city, locale)}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={pick(tStep.cityPh, locale)}
            className={inputCls}
          />
        </Field>
        <Field label={pick(tStep.country, locale)}>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
            <option value="TH">Thailand</option>
            <option value="LA">Laos</option>
            <option value="VN">Vietnam</option>
            <option value="MY">Malaysia</option>
            <option value="SG">Singapore</option>
            <option value="ID">Indonesia</option>
            <option value="PH">Philippines</option>
            <option value="KH">Cambodia</option>
            <option value="MM">Myanmar</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
          </select>
        </Field>
        <Field label={pick(tStep.currency, locale)}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            <option value="THB">THB · ฿</option>
            <option value="USD">USD · $</option>
            <option value="EUR">EUR · €</option>
            <option value="GBP">GBP · £</option>
            <option value="JPY">JPY · ¥</option>
            <option value="SGD">SGD · S$</option>
            <option value="MYR">MYR · RM</option>
            <option value="IDR">IDR · Rp</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Step 3 ---------- */

function Step3({
  propertyType,
  tStep,
  locale,
  rooms,
  addRoom,
  updateRoom,
  removeRoom,
}: {
  propertyType: PropertyType;
  tStep: typeof import("@/lib/i18n").translations.onboarding.step3;
  locale: "th" | "en";
  rooms: RoomRow[];
  addRoom: () => void;
  updateRoom: (i: number, patch: Partial<RoomRow>) => void;
  removeRoom: (i: number) => void;
}) {
  const subtitle =
    propertyType === "monthly"
      ? tStep.subtitleMonthly
      : propertyType === "both"
      ? tStep.subtitleBoth
      : tStep.subtitleDaily;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {pick(tStep.title, locale)}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{pick(subtitle, locale)}</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
        <div className="grid grid-cols-[1fr_84px_120px_44px] gap-2 bg-zinc-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <div>{pick(tStep.typeName, locale)}</div>
          <div className="text-right">{pick(tStep.qty, locale)}</div>
          <div className={propertyType === "both" ? "" : "opacity-0"}>
            {pick(tStep.stayKind, locale)}
          </div>
          <div />
        </div>
        {rooms.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_84px_120px_44px] items-center gap-2 border-t border-zinc-100 px-3 py-2"
          >
            <input
              value={row.name}
              onChange={(e) => updateRoom(i, { name: e.target.value })}
              placeholder={pick(tStep.typeNamePh, locale)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={row.quantity}
              onChange={(e) => {
                const v = e.target.value;
                updateRoom(i, { quantity: v === "" ? "" : Math.max(0, Number(v)) });
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-indigo-500"
            />
            {propertyType === "both" ? (
              <select
                value={row.stay_kind}
                onChange={(e) => updateRoom(i, { stay_kind: e.target.value as StayKind })}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="daily">{pick(tStep.stayKindDaily, locale)}</option>
                <option value="monthly">{pick(tStep.stayKindMonthly, locale)}</option>
              </select>
            ) : (
              <span className="text-xs text-zinc-400">
                {propertyType === "monthly"
                  ? pick(tStep.stayKindMonthly, locale)
                  : pick(tStep.stayKindDaily, locale)}
              </span>
            )}
            <button
              type="button"
              onClick={() => removeRoom(i)}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
              aria-label={pick(tStep.remove, locale)}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m1 0v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4h8z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRoom}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
      >
        {pick(tStep.addRow, locale)}
      </button>
    </div>
  );
}

/* ---------- Footer ---------- */

function Footer({
  step,
  setStep,
  canContinue,
  onFinish,
  pending,
  locale,
  t,
}: {
  step: Step;
  setStep: (s: Step) => void;
  canContinue: boolean;
  onFinish: () => void;
  pending: boolean;
  locale: "th" | "en";
  t: typeof import("@/lib/i18n").translations;
}) {
  return (
    <div className="mt-7 flex items-center justify-between">
      <button
        type="button"
        onClick={() => setStep((step - 1) as Step)}
        disabled={step === 1 || pending}
        className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← {pick(t.onboarding.back, locale)}
      </button>
      {step < 3 ? (
        <button
          type="button"
          onClick={() => setStep((step + 1) as Step)}
          disabled={!canContinue}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
        >
          {pick(t.onboarding.continue, locale)}
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={onFinish}
          disabled={!canContinue || pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          {pending ? pick(t.onboarding.saving, locale) : pick(t.onboarding.finish, locale)}
        </button>
      )}
    </div>
  );
}

/* ---------- Icons ---------- */

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-7a4 4 0 014-4h10a4 4 0 014 4v7M3 18h18M3 18v2M21 18v2M8 11V9a1 1 0 011-1h2a1 1 0 011 1v2" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 7h6M9 11h6M9 15h6M4 21h16" />
    </svg>
  );
}

function MixedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h6V3H3v10zm0 8h6v-6H3v6zm12 0h6V11h-6v10zm0-18v6h6V3h-6z" />
    </svg>
  );
}
