"use client";

// Monthly-tenant detail workspace. Everything read-only renders straight off
// the server `detail` prop; after any mutation we router.refresh() to re-pull.
// Only the editable forms (rate config, add-reading, generate-bill, move-out
// inputs, new-contract modal) live in local state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Gauge,
  Receipt,
  FileText,
  Printer,
  LogOut,
  CalendarClock,
} from "lucide-react";
import type {
  RentalTenant,
  MeterReading,
  RentalBill,
  RentalContract,
} from "@/lib/db/rentals";
import type { Booking } from "@/lib/db/bookings";
import {
  calculateBill,
  moveOutSettlement,
  meterUsage,
  isOpenEnded,
} from "@/lib/rental-calc";
import { buildContractBody } from "@/lib/contracts";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import {
  saveTenantConfig,
  addReading,
  removeReading,
  generateBill,
  issueBillAction,
  setBillStatusAction,
  removeBill,
  makeContract,
  issueContractAction,
  removeContract,
} from "@/app/app/rentals/actions";

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";
const card = "app-surface rounded-2xl border border-[var(--app-border)] p-5";

const BILL_STATUS_COLOR: Record<RentalBill["status"], string> = {
  draft: "#6b7280",
  issued: "#2563eb",
  paid: "var(--app-success)",
};

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    back: "กลับ",
    room: "ห้อง",
    openEnded: "ไม่กำหนดสิ้นสุด",
    until: "ถึง",
    // section 2
    rateFees: "ค่าเช่าและค่าธรรมเนียม",
    setupHint: "ยังไม่ได้ตั้งค่าอัตรา — บันทึกการตั้งค่าก่อน",
    setupBanner: "ห้องนี้ยังไม่ได้ตั้งค่าอัตราค่าเช่า กรุณากรอกและบันทึกการตั้งค่าด้านล่างก่อน",
    monthlyRent: "ค่าเช่ารายเดือน",
    deposit: "เงินประกัน",
    advanceRent: "ค่าเช่าล่วงหน้า",
    electricRate: "ค่าไฟ/หน่วย",
    waterRate: "ค่าน้ำ/หน่วย",
    otherFees: "ค่าใช้จ่ายอื่น",
    occupants: "จำนวนผู้พัก",
    notes: "หมายเหตุ",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    // section 3
    meters: "ค่ามิเตอร์",
    date: "วันที่",
    electric: "ไฟ",
    water: "น้ำ",
    usage: "ใช้ไป",
    note: "หมายเหตุ",
    addReading: "เพิ่มค่ามิเตอร์",
    added: "เพิ่มแล้ว",
    deleted: "ลบแล้ว",
    noReadings: "ยังไม่มีค่ามิเตอร์",
    // section 4
    genBill: "สร้างบิล",
    period: "เดือน",
    electricUnits: "หน่วยไฟ",
    waterUnits: "หน่วยน้ำ",
    electricAmt: "ค่าไฟ",
    waterAmt: "ค่าน้ำ",
    rent: "ค่าเช่า",
    other: "อื่นๆ",
    total: "รวม",
    generate: "สร้างบิล",
    generated: "สร้างบิลแล้ว",
    needPeriod: "เลือกเดือนก่อน",
    // section 5
    billHistory: "ประวัติบิล",
    number: "เลขที่",
    status: "สถานะ",
    issue: "ออกบิล",
    issued: "ออกบิลแล้ว",
    markPaid: "ทำเครื่องหมายชำระแล้ว",
    paidDone: "ชำระแล้ว",
    noBills: "ยังไม่มีบิล",
    st_draft: "ฉบับร่าง",
    st_issued: "ออกบิลแล้ว",
    st_paid: "ชำระแล้ว",
    // section 6
    contracts: "สัญญาเช่า",
    newContract: "สร้างสัญญา",
    startDate: "วันเริ่ม",
    endDate: "วันสิ้นสุด",
    landlord: "ผู้ให้เช่า",
    tenant: "ผู้เช่า",
    bodyTh: "เนื้อหา (ไทย)",
    bodyEn: "เนื้อหา (อังกฤษ)",
    create: "สร้าง",
    contractCreated: "สร้างสัญญาแล้ว",
    contractIssued: "ออกสัญญาแล้ว",
    print: "พิมพ์",
    noContracts: "ยังไม่มีสัญญา",
    ct_draft: "ฉบับร่าง",
    ct_issued: "ออกแล้ว",
    // section 7
    moveOut: "สรุปการย้ายออก",
    finalElectric: "ค่าไฟสุดท้าย",
    finalWater: "ค่าน้ำสุดท้าย",
    finalOther: "ค่าใช้จ่ายอื่น",
    held: "ยอดที่ถือไว้",
    deductions: "หักลบ",
    refund: "คืนเงิน",
    moveOutNote: "ค่าเช่าล่วงหน้าถูกใช้ไป; เงินคืนสุทธิ = เงินประกัน − ค่าน้ำค่าไฟ − อื่นๆ",
    // misc
    cancel: "ยกเลิก",
    delete: "ลบ",
    deleteConfirm: "ลบรายการนี้?",
  },
  en: {
    back: "Back",
    room: "Room",
    openEnded: "Open-ended",
    until: "until",
    rateFees: "Rate & fees",
    setupHint: "No rate config yet — set it up",
    setupBanner: "This room has no rate config yet. Fill in and save the settings below first.",
    monthlyRent: "Monthly rent",
    deposit: "Deposit",
    advanceRent: "Advance rent",
    electricRate: "Electric rate / unit",
    waterRate: "Water rate / unit",
    otherFees: "Other fees",
    occupants: "Occupants",
    notes: "Notes",
    save: "Save",
    saved: "Saved",
    meters: "Meter readings",
    date: "Date",
    electric: "Electric",
    water: "Water",
    usage: "Usage",
    note: "Note",
    addReading: "Add reading",
    added: "Reading added",
    deleted: "Deleted",
    noReadings: "No readings yet",
    genBill: "Generate bill",
    period: "Period month",
    electricUnits: "Electric units",
    waterUnits: "Water units",
    electricAmt: "Electric",
    waterAmt: "Water",
    rent: "Rent",
    other: "Other",
    total: "Total",
    generate: "Generate bill",
    generated: "Bill generated",
    needPeriod: "Pick a period month first",
    billHistory: "Bill history",
    number: "Number",
    status: "Status",
    issue: "Issue",
    issued: "Issued",
    markPaid: "Mark paid",
    paidDone: "Marked paid",
    noBills: "No bills yet",
    st_draft: "Draft",
    st_issued: "Issued",
    st_paid: "Paid",
    contracts: "Contracts",
    newContract: "New contract",
    startDate: "Start date",
    endDate: "End date",
    landlord: "Landlord",
    tenant: "Tenant",
    bodyTh: "Body (Thai)",
    bodyEn: "Body (English)",
    create: "Create",
    contractCreated: "Contract created",
    contractIssued: "Contract issued",
    print: "Print",
    noContracts: "No contracts yet",
    ct_draft: "Draft",
    ct_issued: "Issued",
    moveOut: "Move-out settlement",
    finalElectric: "Final electric",
    finalWater: "Final water",
    finalOther: "Other charges",
    held: "Held",
    deductions: "Deductions",
    refund: "Refund",
    moveOutNote: "advance rent is consumed; net refund = deposit − utilities − other",
    cancel: "Cancel",
    delete: "Delete",
    deleteConfirm: "Delete this item?",
  },
};

type Num = number | "";
const n = (v: Num): number => (v === "" ? 0 : Number(v) || 0);

export default function TenantDetailClient({
  detail,
  roomNumber,
  propertyName,
  currency,
  landlordName,
}: {
  detail: {
    booking: Booking;
    rentalTenant: RentalTenant | null;
    readings: MeterReading[];
    bills: RentalBill[];
    contracts: RentalContract[];
  };
  roomNumber: string;
  propertyName: string;
  currency: string;
  landlordName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const { booking, rentalTenant, readings, bills, contracts } = detail;
  const bookingId = detail.booking.id;
  const noConfig = rentalTenant == null;

  const money = (v: number) => `${currency} ${(Number(v) || 0).toLocaleString()}`;

  // ── section 2: rate config ──────────────────────────────────────────────────
  const [cfg, setCfg] = useState({
    monthly_rent: (rentalTenant?.monthly_rent ?? 0) as Num,
    deposit: (rentalTenant?.deposit ?? 0) as Num,
    advance_rent: (rentalTenant?.advance_rent ?? 0) as Num,
    electric_rate: (rentalTenant?.electric_rate ?? 0) as Num,
    water_rate: (rentalTenant?.water_rate ?? 0) as Num,
    other_fees: (rentalTenant?.other_fees ?? 0) as Num,
    occupants: (rentalTenant?.occupants ?? 1) as Num,
    notes: rentalTenant?.notes ?? "",
  });
  const [savingCfg, setSavingCfg] = useState(false);

  async function onSaveCfg() {
    setSavingCfg(true);
    const res = await saveTenantConfig(bookingId, {
      monthly_rent: n(cfg.monthly_rent),
      deposit: n(cfg.deposit),
      advance_rent: n(cfg.advance_rent),
      electric_rate: n(cfg.electric_rate),
      water_rate: n(cfg.water_rate),
      other_fees: n(cfg.other_fees),
      occupants: n(cfg.occupants),
      notes: cfg.notes.trim() || null,
    });
    setSavingCfg(false);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // Effective rates used by usage/bill maths (fall back to current cfg).
  const electricRate = rentalTenant?.electric_rate ?? n(cfg.electric_rate);
  const waterRate = rentalTenant?.water_rate ?? n(cfg.water_rate);

  // Usage between the two most-recent readings (readings are newest-first).
  const latestElectricUsage =
    readings.length >= 2 ? meterUsage(readings[1].electric, readings[0].electric) : 0;
  const latestWaterUsage =
    readings.length >= 2 ? meterUsage(readings[1].water, readings[0].water) : 0;

  // ── section 3: add reading ──────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [newReading, setNewReading] = useState<{
    reading_date: string;
    electric: Num;
    water: Num;
    note: string;
  }>({ reading_date: today, electric: "", water: "", note: "" });
  const [addingReading, setAddingReading] = useState(false);

  async function onAddReading() {
    setAddingReading(true);
    const res = await addReading(bookingId, {
      reading_date: newReading.reading_date,
      electric: newReading.electric === "" ? null : n(newReading.electric),
      water: newReading.water === "" ? null : n(newReading.water),
      note: newReading.note.trim() || null,
    });
    setAddingReading(false);
    if (res.ok) {
      toast.success(tr.added);
      setNewReading({ reading_date: today, electric: "", water: "", note: "" });
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onRemoveReading(id: string) {
    if (!window.confirm(tr.deleteConfirm)) return;
    const res = await removeReading(id, bookingId);
    if (res.ok) {
      toast.success(tr.deleted);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── section 4: generate bill ────────────────────────────────────────────────
  const [bill, setBill] = useState<{
    period: string; // YYYY-MM
    rent: Num;
    electricUnits: Num;
    waterUnits: Num;
    other: Num;
  }>({
    period: today.slice(0, 7),
    rent: (rentalTenant?.monthly_rent ?? 0) as Num,
    electricUnits: latestElectricUsage as Num,
    waterUnits: latestWaterUsage as Num,
    other: (rentalTenant?.other_fees ?? 0) as Num,
  });
  const [generating, setGenerating] = useState(false);

  const billCalc = calculateBill({
    rent: n(bill.rent),
    electricUnits: n(bill.electricUnits),
    electricRate,
    waterUnits: n(bill.waterUnits),
    waterRate,
    other: n(bill.other),
  });

  async function onGenerateBill() {
    if (!bill.period) return toast.error(tr.needPeriod);
    setGenerating(true);
    const res = await generateBill(bookingId, {
      period_month: `${bill.period}-01`,
      ...billCalc,
    });
    setGenerating(false);
    if (res.ok) {
      toast.success(tr.generated);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── section 5: bill actions ─────────────────────────────────────────────────
  const [billBusy, setBillBusy] = useState<string | null>(null);

  async function onIssueBill(id: string) {
    setBillBusy(id);
    const res = await issueBillAction(id, bookingId);
    setBillBusy(null);
    if (res.ok) {
      toast.success(tr.issued);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }
  async function onMarkBillPaid(id: string) {
    setBillBusy(id);
    const res = await setBillStatusAction(id, bookingId, "paid");
    setBillBusy(null);
    if (res.ok) {
      toast.success(tr.paidDone);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }
  async function onRemoveBill(id: string) {
    if (!window.confirm(tr.deleteConfirm)) return;
    setBillBusy(id);
    const res = await removeBill(id, bookingId);
    setBillBusy(null);
    if (res.ok) {
      toast.success(tr.deleted);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── section 6: contracts ────────────────────────────────────────────────────
  const [contractOpen, setContractOpen] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractBusy, setContractBusy] = useState<string | null>(null);

  const blankContract = () => {
    const startDate = booking.check_in;
    const endDate = booking.check_out;
    const body = buildContractBody({
      landlordName,
      tenantName: booking.guest_name,
      propertyName,
      roomNumber,
      monthlyRent: rentalTenant?.monthly_rent ?? 0,
      deposit: rentalTenant?.deposit ?? 0,
      startDate,
      endDate,
      currency,
    });
    return {
      start_date: startDate,
      end_date: endDate,
      monthly_rent: (rentalTenant?.monthly_rent ?? 0) as Num,
      deposit: (rentalTenant?.deposit ?? 0) as Num,
      body_th: body.th,
      body_en: body.en,
    };
  };
  const [contractForm, setContractForm] = useState(blankContract);

  function openContractModal() {
    setContractForm(blankContract());
    setContractOpen(true);
  }

  async function onCreateContract() {
    setCreatingContract(true);
    const res = await makeContract(bookingId, {
      start_date: contractForm.start_date || null,
      end_date: contractForm.end_date || null,
      monthly_rent: n(contractForm.monthly_rent),
      deposit: n(contractForm.deposit),
      landlord_name: landlordName,
      tenant_name: booking.guest_name,
      body_th: contractForm.body_th,
      body_en: contractForm.body_en,
    });
    setCreatingContract(false);
    if (res.ok) {
      toast.success(tr.contractCreated);
      setContractOpen(false);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onIssueContract(id: string) {
    setContractBusy(id);
    const res = await issueContractAction(id, bookingId);
    setContractBusy(null);
    if (res.ok) {
      toast.success(tr.contractIssued);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }
  async function onRemoveContract(id: string) {
    if (!window.confirm(tr.deleteConfirm)) return;
    setContractBusy(id);
    const res = await removeContract(id, bookingId);
    setContractBusy(null);
    if (res.ok) {
      toast.success(tr.deleted);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── section 7: move-out ─────────────────────────────────────────────────────
  const [mo, setMo] = useState<{ electric: Num; water: Num; other: Num }>({
    electric: "",
    water: "",
    other: "",
  });
  const settlement = moveOutSettlement({
    deposit: rentalTenant?.deposit ?? 0,
    advance_rent: rentalTenant?.advance_rent ?? 0,
    electric: n(mo.electric),
    water: n(mo.water),
    other: n(mo.other),
  });

  const numInput = (v: Num, set: (x: Num) => void, extra = "") => (
    <input
      type="number"
      min={0}
      className={`${field} ${extra}`}
      value={v}
      onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );

  const ContractStatusBadge = ({ s }: { s: RentalContract["status"] }) => (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: s === "issued" ? "#2563eb" : "#6b7280" }}
    >
      {tr[`ct_${s}`]}
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl pb-10">
      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => router.push("/app/rentals")}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-fg)]"
        >
          <ArrowLeft size={15} /> {tr.back}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{booking.guest_name}</h1>
          <span className="rounded-lg bg-[var(--app-surface-2)] px-2.5 py-0.5 text-sm font-medium text-[var(--app-fg-muted)]">
            {tr.room} {roomNumber}
          </span>
          {booking.phone && (
            <span className="text-sm text-[var(--app-fg-muted)]">{booking.phone}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] px-2.5 py-0.5 text-xs font-medium text-[var(--app-fg-muted)]">
            <CalendarClock size={13} />
            {isOpenEnded(booking.check_out) ? tr.openEnded : `${tr.until} ${booking.check_out}`}
          </span>
        </div>
      </div>

      {noConfig && (
        <div className="mb-5 rounded-2xl border border-[var(--app-danger)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)]">
          {tr.setupBanner}
        </div>
      )}

      {/* ── 2. Rate & fees ─────────────────────────────────────────────────── */}
      <div className={`${card} mb-5`}>
        <h2 className="mb-4 text-sm font-semibold">{tr.rateFees}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label}>
              {tr.monthlyRent} ({currency})
            </label>
            {numInput(cfg.monthly_rent, (x) => setCfg({ ...cfg, monthly_rent: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.deposit} ({currency})
            </label>
            {numInput(cfg.deposit, (x) => setCfg({ ...cfg, deposit: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.advanceRent} ({currency})
            </label>
            {numInput(cfg.advance_rent, (x) => setCfg({ ...cfg, advance_rent: x }))}
          </div>
          <div>
            <label className={label}>{tr.occupants}</label>
            {numInput(cfg.occupants, (x) => setCfg({ ...cfg, occupants: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.electricRate} ({currency})
            </label>
            {numInput(cfg.electric_rate, (x) => setCfg({ ...cfg, electric_rate: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.waterRate} ({currency})
            </label>
            {numInput(cfg.water_rate, (x) => setCfg({ ...cfg, water_rate: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.otherFees} ({currency})
            </label>
            {numInput(cfg.other_fees, (x) => setCfg({ ...cfg, other_fees: x }))}
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={label}>{tr.notes}</label>
            <input
              className={field}
              value={cfg.notes}
              onChange={(e) => setCfg({ ...cfg, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={onSaveCfg} loading={savingCfg}>
            <Save size={15} /> {tr.save}
          </Button>
          {noConfig && (
            <span className="text-xs text-[var(--app-fg-muted)]">{tr.setupHint}</span>
          )}
        </div>
      </div>

      {/* ── 3 + 4: meters + generate bill ──────────────────────────────────── */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        {/* 3. Meter readings */}
        <div className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Gauge size={15} /> {tr.meters}
          </h2>

          {readings.length === 0 ? (
            <p className="mb-4 text-sm text-[var(--app-fg-muted)]">{tr.noReadings}</p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="py-2 pr-2 font-medium">{tr.date}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.electric}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.water}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.usage}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => {
                    const next = readings[i + 1];
                    const eUse = next ? meterUsage(next.electric, r.electric) : 0;
                    const wUse = next ? meterUsage(next.water, r.water) : 0;
                    return (
                      <tr key={r.id} className="border-t border-[var(--app-border)]">
                        <td className="py-2 pr-2 whitespace-nowrap">{r.reading_date}</td>
                        <td className="py-2 px-2 text-right">{r.electric ?? "—"}</td>
                        <td className="py-2 px-2 text-right">{r.water ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-[var(--app-fg-muted)] whitespace-nowrap">
                          {next ? `⚡${eUse} 💧${wUse}` : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onRemoveReading(r.id)}
                            aria-label={tr.delete}
                            className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* inline add form */}
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--app-border)] pt-4">
            <div className="col-span-2">
              <label className={label}>{tr.date}</label>
              <input
                type="date"
                className={field}
                value={newReading.reading_date}
                onChange={(e) =>
                  setNewReading({ ...newReading, reading_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>{tr.electric}</label>
              {numInput(newReading.electric, (x) =>
                setNewReading({ ...newReading, electric: x })
              )}
            </div>
            <div>
              <label className={label}>{tr.water}</label>
              {numInput(newReading.water, (x) =>
                setNewReading({ ...newReading, water: x })
              )}
            </div>
            <div className="col-span-2">
              <label className={label}>{tr.note}</label>
              <input
                className={field}
                value={newReading.note}
                onChange={(e) => setNewReading({ ...newReading, note: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Button variant="ghost" size="sm" onClick={onAddReading} loading={addingReading}>
                <Plus size={14} /> {tr.addReading}
              </Button>
            </div>
          </div>
        </div>

        {/* 4. Generate bill */}
        <div className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Receipt size={15} /> {tr.genBill}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>{tr.period}</label>
              <input
                type="month"
                className={field}
                value={bill.period}
                onChange={(e) => setBill({ ...bill, period: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>
                {tr.rent} ({currency})
              </label>
              {numInput(bill.rent, (x) => setBill({ ...bill, rent: x }), "text-right")}
            </div>
            <div>
              <label className={label}>
                {tr.other} ({currency})
              </label>
              {numInput(bill.other, (x) => setBill({ ...bill, other: x }), "text-right")}
            </div>
            <div>
              <label className={label}>{tr.electricUnits}</label>
              {numInput(
                bill.electricUnits,
                (x) => setBill({ ...bill, electricUnits: x }),
                "text-right"
              )}
            </div>
            <div>
              <label className={label}>{tr.waterUnits}</label>
              {numInput(
                bill.waterUnits,
                (x) => setBill({ ...bill, waterUnits: x }),
                "text-right"
              )}
            </div>
          </div>

          {/* live preview */}
          <dl className="mt-4 space-y-1.5 border-t border-[var(--app-border)] pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.rent}</dt>
              <dd>{money(billCalc.rent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">
                {tr.electricAmt} ({billCalc.electric_units})
              </dt>
              <dd>{money(billCalc.electric_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">
                {tr.waterAmt} ({billCalc.water_units})
              </dt>
              <dd>{money(billCalc.water_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.other}</dt>
              <dd>{money(billCalc.other)}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--app-border)] pt-1.5 font-semibold">
              <dt>{tr.total}</dt>
              <dd>{money(billCalc.total)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <Button className="w-full" onClick={onGenerateBill} loading={generating}>
              {tr.generate}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5. Bill history ────────────────────────────────────────────────── */}
      <div className={`${card} mb-5`}>
        <h2 className="mb-4 text-sm font-semibold">{tr.billHistory}</h2>
        {bills.length === 0 ? (
          <EmptyState icon={<Receipt size={20} />} title={tr.noBills} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="py-2 pr-2 font-medium">{tr.period}</th>
                  <th className="py-2 px-2 font-medium">{tr.number}</th>
                  <th className="py-2 px-2 text-right font-medium">{tr.total}</th>
                  <th className="py-2 px-2 font-medium">{tr.status}</th>
                  <th className="py-2 pl-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--app-border)]">
                    <td className="py-2 pr-2 whitespace-nowrap">{b.period_month.slice(0, 7)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {b.number ?? (
                        <span className="text-[var(--app-fg-muted)]">{tr.st_draft}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{money(b.total)}</td>
                    <td className="py-2 px-2">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: BILL_STATUS_COLOR[b.status] }}
                      >
                        {tr[`st_${b.status}`]}
                      </span>
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {!b.number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onIssueBill(b.id)}
                            loading={billBusy === b.id}
                          >
                            {tr.issue}
                          </Button>
                        )}
                        {b.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMarkBillPaid(b.id)}
                            loading={billBusy === b.id}
                          >
                            {tr.markPaid}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveBill(b.id)}
                          aria-label={tr.delete}
                          className="px-1 text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 6. Contracts ───────────────────────────────────────────────────── */}
      <div className={`${card} mb-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText size={15} /> {tr.contracts}
          </h2>
          <Button size="sm" onClick={openContractModal}>
            <Plus size={14} /> {tr.newContract}
          </Button>
        </div>

        {contracts.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title={tr.noContracts} />
        ) : (
          <ul className="divide-y divide-[var(--app-border)]">
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">
                  {c.number ?? <span className="text-[var(--app-fg-muted)]">{tr.ct_draft}</span>}
                </span>
                <ContractStatusBadge s={c.status} />
                <span className="text-sm text-[var(--app-fg-muted)]">
                  {(c.start_date ?? "—")} → {(c.end_date ?? "—")}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {c.status !== "issued" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onIssueContract(c.id)}
                      loading={contractBusy === c.id}
                    >
                      {tr.issue}
                    </Button>
                  )}
                  <a
                    href={`/print/contract/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--app-border)] px-3 text-xs font-medium transition-colors hover:bg-[var(--app-surface-2)]"
                  >
                    <Printer size={14} /> {tr.print}
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveContract(c.id)}
                    aria-label={tr.delete}
                    className="px-1 text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 7. Move-out settlement ─────────────────────────────────────────── */}
      <div className={card}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <LogOut size={15} /> {tr.moveOut}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>
              {tr.finalElectric} ({currency})
            </label>
            {numInput(mo.electric, (x) => setMo({ ...mo, electric: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.finalWater} ({currency})
            </label>
            {numInput(mo.water, (x) => setMo({ ...mo, water: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.finalOther} ({currency})
            </label>
            {numInput(mo.other, (x) => setMo({ ...mo, other: x }))}
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-[var(--app-border)] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--app-fg-muted)]">{tr.held}</dt>
            <dd>{money(settlement.held)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--app-fg-muted)]">{tr.deductions}</dt>
            <dd>−{money(settlement.deductions)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--app-border)] pt-1.5 text-base font-semibold">
            <dt>{tr.refund}</dt>
            <dd
              style={{
                color: settlement.refund >= 0 ? "var(--app-success)" : "var(--app-danger)",
              }}
            >
              {money(settlement.refund)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--app-fg-muted)]">{tr.moveOutNote}</p>
      </div>

      {/* ── New contract modal ─────────────────────────────────────────────── */}
      <Modal
        open={contractOpen}
        onClose={() => setContractOpen(false)}
        title={tr.newContract}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setContractOpen(false)}>
              {tr.cancel}
            </Button>
            <Button onClick={onCreateContract} loading={creatingContract}>
              {tr.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr.startDate}</label>
              <input
                type="date"
                className={field}
                value={contractForm.start_date}
                onChange={(e) =>
                  setContractForm({ ...contractForm, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>{tr.endDate}</label>
              <input
                type="date"
                className={field}
                value={contractForm.end_date}
                onChange={(e) =>
                  setContractForm({ ...contractForm, end_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className={label}>
                {tr.monthlyRent} ({currency})
              </label>
              {numInput(contractForm.monthly_rent, (x) =>
                setContractForm({ ...contractForm, monthly_rent: x })
              )}
            </div>
            <div>
              <label className={label}>
                {tr.deposit} ({currency})
              </label>
              {numInput(contractForm.deposit, (x) =>
                setContractForm({ ...contractForm, deposit: x })
              )}
            </div>
          </div>
          <div>
            <label className={label}>{tr.bodyTh}</label>
            <textarea
              rows={6}
              className={`${field} font-mono text-xs`}
              value={contractForm.body_th}
              onChange={(e) =>
                setContractForm({ ...contractForm, body_th: e.target.value })
              }
            />
          </div>
          <div>
            <label className={label}>{tr.bodyEn}</label>
            <textarea
              rows={6}
              className={`${field} font-mono text-xs`}
              value={contractForm.body_en}
              onChange={(e) =>
                setContractForm({ ...contractForm, body_en: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
