"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Sparkles, Plus, Lock } from "lucide-react";
import type { Property } from "@/lib/db/properties";
import { useAppT } from "@/lib/app-i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import { planLimits, canAddProperty } from "@/lib/plan";
import { savePropertyDetails, addProperty } from "@/app/app/actions";

const field =
  "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

export default function SettingsClient({
  property,
  plan,
  propertyCount,
}: {
  property: Property;
  plan: string;
  propertyCount: number;
}) {
  const t = useAppT();
  const toast = useToast();
  const router = useRouter();
  const limits = planLimits(plan);
  const allowAdd = canAddProperty(plan, propertyCount);

  const [form, setForm] = useState({
    name: property.name,
    address: property.address ?? "",
    city: property.city ?? "",
    currency: property.currency,
    timezone: property.timezone,
  });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", property_type: "daily" as const, city: "" });

  async function save() {
    setSaving(true);
    const res = await savePropertyDetails(property.id, form);
    setSaving(false);
    if (res.ok) {
      toast.success(t("settings.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function add() {
    if (!newProp.name.trim()) return;
    setSaving(true);
    const res = await addProperty(newProp);
    setSaving(false);
    if (res.ok) {
      toast.success(t("settings.saved"));
      setAdding(false);
      setNewProp({ name: "", property_type: "daily", city: "" });
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      {/* Property details */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{t("settings.property")}</h2>
          <span className="ml-auto rounded-full bg-[var(--app-surface-2)] px-2 py-0.5 font-mono text-xs text-[var(--app-fg-muted)]">
            {property.code}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>{t("settings.name")}</label>
            <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t("settings.address")}</label>
            <input className={field} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t("settings.city")}</label>
            <input className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t("settings.currency")}</label>
            <input className={field} value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t("settings.timezone")}</label>
            <input className={field} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={save} loading={saving}>
            {t("settings.save")}
          </Button>
        </div>
      </section>

      {/* Plan + add property */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{t("settings.plan")}</h2>
          <span className="ml-auto rounded-full bg-[var(--app-accent)] px-3 py-0.5 text-xs font-semibold uppercase text-[var(--app-accent-fg)]">
            {limits.label}
          </span>
        </div>
        <p className="text-sm text-[var(--app-fg-muted)]">
          {propertyCount} / {limits.maxProperties} {t("settings.properties")}
        </p>

        {allowAdd ? (
          adding ? (
            <div className="mt-4 space-y-3">
              <input className={field} placeholder={t("settings.name")} value={newProp.name} onChange={(e) => setNewProp({ ...newProp, name: e.target.value })} />
              <input className={field} placeholder={t("settings.city")} value={newProp.city} onChange={(e) => setNewProp({ ...newProp, city: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={add} loading={saving}>{t("shell.addProperty")}</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setAdding(true)} className="mt-4">
              <Plus size={15} /> {t("shell.addProperty")}
            </Button>
          )
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-fg-muted)]">
            <Lock size={14} /> {t("shell.upgradeForMore")}
          </div>
        )}
      </section>
    </div>
  );
}
