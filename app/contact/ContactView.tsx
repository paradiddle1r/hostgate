"use client";

import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { submitContact } from "@/lib/supabase";

export default function ContactView() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    property: "",
    rooms: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");
    const { error } = await submitContact({
      name: form.name,
      email: form.email,
      phone: form.phone,
      property_name: form.property,
      rooms: form.rooms,
      message: form.message,
    });
    if (error) {
      setErrorMsg(error.message);
      setState("error");
      return;
    }
    setState("success");
  };

  return (
    <section className="relative pt-32 pb-20">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {pick(t.contact.pageTitle, locale)}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-400">
            {pick(t.contact.pageSubtitle, locale)}
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            {state === "success" ? (
              <SuccessState message={pick(t.contact.success, locale)} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label={pick(t.contact.name, locale)}
                    placeholder={pick(t.contact.namePh, locale)}
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    required
                  />
                  <Field
                    label={pick(t.contact.email, locale)}
                    type="email"
                    placeholder={pick(t.contact.emailPh, locale)}
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label={pick(t.contact.phone, locale)}
                    placeholder={pick(t.contact.phonePh, locale)}
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                  <Field
                    label={pick(t.contact.property, locale)}
                    placeholder={pick(t.contact.propertyPh, locale)}
                    value={form.property}
                    onChange={(v) => setForm({ ...form, property: v })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    {pick(t.contact.rooms, locale)}
                  </label>
                  <select
                    value={form.rooms}
                    onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                    className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
                  >
                    <option value="" className="bg-zinc-900">
                      {pick(t.contact.selectRooms, locale)}
                    </option>
                    <option value="1-5" className="bg-zinc-900">1–5</option>
                    <option value="6-20" className="bg-zinc-900">6–20</option>
                    <option value="21-50" className="bg-zinc-900">21–50</option>
                    <option value="51+" className="bg-zinc-900">51+</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    {pick(t.contact.message, locale)}
                  </label>
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={pick(t.contact.messagePh, locale)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
                >
                  {state === "submitting"
                    ? pick(t.contact.submitting, locale)
                    : pick(t.contact.submit, locale)}
                </button>

                {state === "error" && (
                  <p className="text-sm text-rose-400">
                    {locale === "th" ? "เกิดข้อผิดพลาด: " : "Something went wrong: "}
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Other channels */}
          <aside className="space-y-3">
            <h2 className="text-sm font-semibold text-white">
              {pick(t.contact.otherChannels, locale)}
            </h2>
            <ChannelLink
              icon={<LineIcon />}
              label={pick(t.contact.lineLabel, locale)}
              value="@hostgate"
              href="https://line.me/R/ti/p/@hostgate"
            />
            <ChannelLink
              icon={<FbIcon />}
              label={pick(t.contact.fbLabel, locale)}
              value="m.me/hostgate"
              href="https://m.me/hostgate"
            />
            <ChannelLink
              icon={<MailIcon />}
              label={pick(t.contact.emailDirect, locale)}
              value="hello@hostgate.app"
              href="mailto:hello@hostgate.app"
            />
            <ChannelLink
              icon={<PhoneIcon />}
              label={pick(t.contact.phoneDirect, locale)}
              value="02-xxx-xxxx"
              href="tel:+6620000000"
            />
          </aside>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-fuchsia-400">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-fuchsia-500/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
      />
    </div>
  );
}

function SuccessState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="mt-5 max-w-sm text-base font-medium text-white">{message}</p>
    </div>
  );
}

function ChannelLink({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">{icon}</div>
      <div>
        <div className="text-xs text-zinc-400">{label}</div>
        <div className="text-sm font-medium text-white">{value}</div>
      </div>
    </a>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-400" fill="currentColor">
      <path d="M12 2C6.5 2 2 5.6 2 10c0 4 3.5 7.4 8.2 8 0.4 0.1 0.9 0.3 1 0.6 0.1 0.3 0.1 0.7 0 1 0 0-0.1 0.6-0.1 0.7 0 0.2-0.2 0.9 0.8 0.5C13 20.4 18 17 19.7 14.6c1.4-1.4 2.3-2.9 2.3-4.6C22 5.6 17.5 2 12 2z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.5c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12H16l-.4 2.9h-2.2v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.3a1 1 0 011 .8l.9 3.6a1 1 0 01-.3 1L7.2 9.7a14 14 0 007 7l1.3-1.7a1 1 0 011-.3l3.6.9a1 1 0 01.8 1V19a2 2 0 01-2 2h-1a17 17 0 01-17-17v-1z" />
    </svg>
  );
}
