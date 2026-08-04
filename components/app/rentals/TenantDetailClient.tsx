"use client";

// Monthly-tenant detail workspace. Everything read-only renders straight off
// the server `detail` prop; after any mutation we router.refresh() to re-pull.
// Only the editable forms (rate config, add-reading, generate-bill, move-out
// inputs, new-contract modal) live in local state.

import { useRef, useState } from "react";
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
  Users,
  ClipboardList,
  X,
} from "lucide-react";
import type {
  RentalTenant,
  MeterReading,
  RentalBill,
  RentalContract,
} from "@/lib/db/rentals";
import type { Booking } from "@/lib/db/bookings";
import {
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
import { todayISO } from "@/lib/date";
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
  addCoTenant,
  removeCoTenant,
} from "@/app/app/rentals/actions";

// ── Structured monthly-bill calc (parity with hotel-pms lib/rentals.js) ──────
// Blank/null prev readings stay null (NOT 0) so a missing previous reading
// doesn't bill the whole current meter as consumption. Water has a minimum
// charge floor. Internet + parking are fixed monthly add-ons.
type NumLike = number | string | null | undefined;
const numOrNull = (v: NumLike): number | null =>
  v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v);

export function calcStructuredBill(p: {
  rent: number;
  electricPrev: NumLike;
  electricCurr: NumLike;
  electricRate: number;
  waterPrev: NumLike;
  waterCurr: NumLike;
  waterRate: number;
  waterMinimumCharge: number;
  internet: number;
  parking: number;
  other: number;
}) {
  const ePrev = numOrNull(p.electricPrev);
  const eCurr = numOrNull(p.electricCurr);
  const wPrev = numOrNull(p.waterPrev);
  const wCurr = numOrNull(p.waterCurr);
  const eUnits = eCurr !== null && ePrev !== null ? Math.max(0, eCurr - ePrev) : 0;
  const wUnits = wCurr !== null && wPrev !== null ? Math.max(0, wCurr - wPrev) : 0;
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const electric_amount = r2(eUnits * (Number(p.electricRate) || 0));
  const waterRaw = r2(wUnits * (Number(p.waterRate) || 0));
  const water_amount = Math.max(waterRaw, Number(p.waterMinimumCharge) || 0);
  const rent = r2(p.rent);
  const internet = r2(p.internet);
  const parking = r2(p.parking);
  const other = r2(p.other);
  const total = r2(rent + internet + parking + electric_amount + water_amount + other);
  return {
    electric_units: r2(eUnits),
    electric_amount,
    water_units: r2(wUnits),
    water_amount,
    internet_amount: internet,
    parking_amount: parking,
    total,
  };
}

export interface CoTenant {
  bookingId: string;
  guestName: string;
  phone: string | null;
  monthlyRent: number;
}

export interface BulkTenant {
  bookingId: string;
  roomNumber: string;
  guestName: string;
  prevElectric: number | null;
  prevWater: number | null;
}

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
    waterMin: "ค่าน้ำขั้นต่ำ/เดือน",
    internetFee: "ค่าเน็ต/เดือน",
    parkingFee: "ค่าที่จอดรถ/เดือน",
    billingDay: "วันออกบิล",
    startMeterE: "เลขมิเตอร์ไฟเริ่มต้น",
    startMeterW: "เลขมิเตอร์น้ำเริ่มต้น",
    otherFees: "ค่าใช้จ่ายอื่น",
    occupants: "จำนวนผู้พัก",
    notes: "หมายเหตุ",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    // co-tenants
    coTenants: "ผู้เช่าร่วม",
    coTenantsHint: "บุคคลอื่นในสัญญาเดียวกัน (มิเตอร์/บิลอยู่ที่ผู้เช่าหลัก)",
    addCoTenant: "เพิ่มผู้เช่าร่วม",
    coName: "ชื่อผู้เช่าร่วม",
    coPhone: "เบอร์โทร",
    coRent: "ค่าเช่าส่วนแบ่ง",
    noCoTenants: "ยังไม่มีผู้เช่าร่วม",
    coAdded: "เพิ่มผู้เช่าร่วมแล้ว",
    open: "เปิด",
    needName: "ใส่ชื่อก่อน",
    // bulk meter
    bulkMeter: "บันทึกมิเตอร์หลายห้อง",
    bulkMeterTitle: "บันทึกมิเตอร์รวม",
    bulkDate: "วันที่อ่าน",
    prevE: "ไฟ (ก่อน)",
    newE: "ไฟ (ใหม่)",
    prevW: "น้ำ (ก่อน)",
    newW: "น้ำ (ใหม่)",
    bulkSave: "บันทึกที่กรอก",
    bulkSaved: "บันทึกมิเตอร์แล้ว",
    bulkNone: "ไม่มีค่าที่จะบันทึก",
    // bill structured
    periodStart: "ตั้งแต่",
    periodEnd: "ถึง",
    internet: "เน็ต",
    parking: "ที่จอดรถ",
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
    moveOutNote: "ค่าเช่าล่วงหน้าถูกใช้ไป; เงินคืนสุทธิ = เงินประกัน − ค่าน้ำค่าไฟ − รายการปรับ",
    adjustments: "รายการหัก / ปรับ",
    addAdjust: "เพิ่มรายการ",
    adjustLabel: "รายละเอียด",
    adjustAmount: "จำนวน",
    advanceConsumed: "ใช้ค่าเช่าล่วงหน้า",
    adjustHint: "ค่าบวก = หักจากเงินคืน · ค่าลบ = เพิ่มคืนให้ผู้เช่า",
    removeItem: "ลบ",
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
    waterMin: "Water min charge / mo",
    internetFee: "Internet / mo",
    parkingFee: "Parking / mo",
    billingDay: "Billing day",
    startMeterE: "Start electric meter",
    startMeterW: "Start water meter",
    otherFees: "Other fees",
    occupants: "Occupants",
    notes: "Notes",
    save: "Save",
    saved: "Saved",
    // co-tenants
    coTenants: "Co-tenants",
    coTenantsHint: "Others on the same lease (meters/bills stay on the primary).",
    addCoTenant: "Add co-tenant",
    coName: "Co-tenant name",
    coPhone: "Phone",
    coRent: "Rent share",
    noCoTenants: "No co-tenants yet",
    coAdded: "Co-tenant added",
    open: "Open",
    needName: "Enter a name first",
    // bulk meter
    bulkMeter: "Bulk meter entry",
    bulkMeterTitle: "Bulk meter readings",
    bulkDate: "Reading date",
    prevE: "Electric (prev)",
    newE: "Electric (new)",
    prevW: "Water (prev)",
    newW: "Water (new)",
    bulkSave: "Save entered",
    bulkSaved: "Meter readings saved",
    bulkNone: "Nothing to save",
    // bill structured
    periodStart: "Period start",
    periodEnd: "Period end",
    internet: "Internet",
    parking: "Parking",
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
    moveOutNote: "advance rent is consumed; net refund = deposit − utilities − adjustments",
    adjustments: "Deductions / adjustments",
    addAdjust: "Add line",
    adjustLabel: "Description",
    adjustAmount: "Amount",
    advanceConsumed: "Advance rent consumed",
    adjustHint: "Positive = deducted from refund · negative = credited back to tenant",
    removeItem: "Remove",
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
  coTenants = [],
  bulkTenants = [],
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
  coTenants?: CoTenant[];
  bulkTenants?: BulkTenant[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const { booking, rentalTenant, readings, bills, contracts } = detail;
  const bookingId = detail.booking.id;
  const noConfig = rentalTenant == null;

  const money = (v: number) => `${currency} ${(Number(v) || 0).toLocaleString()}`;
  // A deduction reduces the refund: positive → "−฿x", negative (a credit) → "+฿x".
  const signedDeduct = (d: number) => (d >= 0 ? `−${money(d)}` : `+${money(-d)}`);

  // ── section 2: rate config ──────────────────────────────────────────────────
  const [cfg, setCfg] = useState({
    monthly_rent: (rentalTenant?.monthly_rent ?? 0) as Num,
    deposit: (rentalTenant?.deposit ?? 0) as Num,
    advance_rent: (rentalTenant?.advance_rent ?? 0) as Num,
    electric_rate: (rentalTenant?.electric_rate ?? 0) as Num,
    water_rate: (rentalTenant?.water_rate ?? 0) as Num,
    water_minimum_charge: (rentalTenant?.water_minimum_charge ?? 0) as Num,
    internet_fee: (rentalTenant?.internet_fee ?? 0) as Num,
    parking_fee: (rentalTenant?.parking_fee ?? 0) as Num,
    billing_day: (rentalTenant?.billing_day ?? 1) as Num,
    start_meter_electric: (rentalTenant?.start_meter_electric ?? "") as Num,
    start_meter_water: (rentalTenant?.start_meter_water ?? "") as Num,
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
      water_minimum_charge: n(cfg.water_minimum_charge),
      internet_fee: n(cfg.internet_fee),
      parking_fee: n(cfg.parking_fee),
      billing_day: n(cfg.billing_day) || 1,
      start_meter_electric: cfg.start_meter_electric === "" ? null : n(cfg.start_meter_electric),
      start_meter_water: cfg.start_meter_water === "" ? null : n(cfg.start_meter_water),
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
  const waterMin = rentalTenant?.water_minimum_charge ?? n(cfg.water_minimum_charge);
  const internetFee = rentalTenant?.internet_fee ?? n(cfg.internet_fee);
  const parkingFee = rentalTenant?.parking_fee ?? n(cfg.parking_fee);

  // ── section 3: add reading ──────────────────────────────────────────────────
  const today = todayISO();
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

  // ── section 4: generate bill (structured) ───────────────────────────────────
  // Default a one-month period ending today, and seed prev/curr meter snapshots
  // from the two most-recent readings (or the tenant's start meter as prev).
  const monthAgo = (() => {
    const d = new Date(today + "T00:00:00");
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const seedElecCurr = readings[0]?.electric ?? null;
  const seedElecPrev = readings[1]?.electric ?? rentalTenant?.start_meter_electric ?? null;
  const seedWaterCurr = readings[0]?.water ?? null;
  const seedWaterPrev = readings[1]?.water ?? rentalTenant?.start_meter_water ?? null;

  const [bill, setBill] = useState<{
    periodStart: string;
    periodEnd: string;
    rent: Num;
    electricPrev: Num;
    electricCurr: Num;
    waterPrev: Num;
    waterCurr: Num;
    internet: Num;
    parking: Num;
    other: Num;
  }>({
    periodStart: monthAgo,
    periodEnd: today,
    rent: (rentalTenant?.monthly_rent ?? 0) as Num,
    electricPrev: (seedElecPrev ?? "") as Num,
    electricCurr: (seedElecCurr ?? "") as Num,
    waterPrev: (seedWaterPrev ?? "") as Num,
    waterCurr: (seedWaterCurr ?? "") as Num,
    internet: internetFee as Num,
    parking: parkingFee as Num,
    other: (rentalTenant?.other_fees ?? 0) as Num,
  });
  const [generating, setGenerating] = useState(false);

  const billCalc = calcStructuredBill({
    rent: n(bill.rent),
    electricPrev: bill.electricPrev === "" ? null : n(bill.electricPrev),
    electricCurr: bill.electricCurr === "" ? null : n(bill.electricCurr),
    electricRate,
    waterPrev: bill.waterPrev === "" ? null : n(bill.waterPrev),
    waterCurr: bill.waterCurr === "" ? null : n(bill.waterCurr),
    waterRate,
    waterMinimumCharge: waterMin,
    internet: n(bill.internet),
    parking: n(bill.parking),
    other: n(bill.other),
  });

  async function onGenerateBill() {
    if (!bill.periodStart || !bill.periodEnd) return toast.error(tr.needPeriod);
    setGenerating(true);
    const res = await generateBill(bookingId, {
      // period_month anchors the upsert dedup (booking_id,period_month).
      period_month: `${bill.periodEnd.slice(0, 7)}-01`,
      period_start: bill.periodStart,
      period_end: bill.periodEnd,
      rent: n(bill.rent),
      electric_prev: bill.electricPrev === "" ? null : n(bill.electricPrev),
      electric_curr: bill.electricCurr === "" ? null : n(bill.electricCurr),
      electric_rate: electricRate,
      electric_units: billCalc.electric_units,
      electric_amount: billCalc.electric_amount,
      water_prev: bill.waterPrev === "" ? null : n(bill.waterPrev),
      water_curr: bill.waterCurr === "" ? null : n(bill.waterCurr),
      water_rate: waterRate,
      water_units: billCalc.water_units,
      water_amount: billCalc.water_amount,
      internet_amount: billCalc.internet_amount,
      parking_amount: billCalc.parking_amount,
      other: n(bill.other),
      subtotal: billCalc.total,
      total: billCalc.total,
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

  // ── co-tenants ──────────────────────────────────────────────────────────────
  const [coOpen, setCoOpen] = useState(false);
  const [coBusy, setCoBusy] = useState(false);
  const [coRemoving, setCoRemoving] = useState<string | null>(null);
  const [coForm, setCoForm] = useState<{ name: string; phone: string; rent: Num }>({
    name: "",
    phone: "",
    rent: "",
  });

  function openCo() {
    setCoForm({ name: "", phone: "", rent: "" });
    setCoOpen(true);
  }

  async function onAddCoTenant() {
    if (!coForm.name.trim()) return toast.error(tr.needName);
    setCoBusy(true);
    const res = await addCoTenant(bookingId, {
      guest_name: coForm.name.trim(),
      phone: coForm.phone.trim() || null,
      monthly_rent: n(coForm.rent),
    });
    setCoBusy(false);
    if (res.ok) {
      toast.success(tr.coAdded);
      setCoOpen(false);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onRemoveCoTenant(id: string) {
    if (!window.confirm(tr.deleteConfirm)) return;
    setCoRemoving(id);
    const res = await removeCoTenant(id, bookingId);
    setCoRemoving(null);
    if (res.ok) {
      toast.success(tr.deleted);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── bulk meter entry ────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(today);
  const [bulkBusy, setBulkBusy] = useState(false);
  // bookingId → { electric, water } new readings the operator types in.
  const [bulkRows, setBulkRows] = useState<Record<string, { electric: Num; water: Num }>>({});

  function openBulk() {
    setBulkDate(today);
    setBulkRows(Object.fromEntries(bulkTenants.map((t) => [t.bookingId, { electric: "", water: "" }])));
    setBulkOpen(true);
  }

  async function onSaveBulk() {
    const entries = bulkTenants
      .map((t) => ({ t, v: bulkRows[t.bookingId] ?? { electric: "", water: "" } }))
      .filter((x) => x.v.electric !== "" || x.v.water !== "");
    if (entries.length === 0) return toast.error(tr.bulkNone);
    setBulkBusy(true);
    let okCount = 0;
    for (const { t, v } of entries) {
      const res = await addReading(t.bookingId, {
        reading_date: bulkDate,
        electric: v.electric === "" ? null : n(v.electric),
        water: v.water === "" ? null : n(v.water),
        note: null,
      });
      if (res.ok) okCount++;
    }
    setBulkBusy(false);
    if (okCount > 0) {
      toast.success(`${tr.bulkSaved} (${okCount})`);
      setBulkOpen(false);
      router.refresh();
    } else {
      toast.error(tr.bulkNone);
    }
  }

  // ── section 7: move-out ─────────────────────────────────────────────────────
  // `items` is an open-ended list of adjustment lines. A POSITIVE amount is a
  // deduction (reduces the refund); a NEGATIVE amount is a credit (adds back to
  // the refund). Their signed sum feeds the settlement's `other`.
  type AdjItem = { id: number; label: string; amount: Num };
  const adjId = useRef(0);
  const [mo, setMo] = useState<{ electric: Num; water: Num; items: AdjItem[] }>({
    electric: "",
    water: "",
    items: [],
  });
  const addAdjust = () =>
    setMo((m) => ({ ...m, items: [...m.items, { id: ++adjId.current, label: "", amount: "" }] }));
  const setAdjust = (id: number, patch: Partial<AdjItem>) =>
    setMo((m) => ({ ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeAdjust = (id: number) =>
    setMo((m) => ({ ...m, items: m.items.filter((it) => it.id !== id) }));
  const adjustTotal = mo.items.reduce((s, it) => s + n(it.amount), 0);
  const settlement = moveOutSettlement({
    deposit: rentalTenant?.deposit ?? 0,
    advance_rent: rentalTenant?.advance_rent ?? 0,
    electric: n(mo.electric),
    water: n(mo.water),
    other: adjustTotal,
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
    <div className="mx-auto max-w-[1500px] pb-10">
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
        {bulkTenants.length > 0 && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={openBulk}>
              <ClipboardList size={14} /> {tr.bulkMeter}
            </Button>
          </div>
        )}
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
              {tr.waterMin} ({currency})
            </label>
            {numInput(cfg.water_minimum_charge, (x) =>
              setCfg({ ...cfg, water_minimum_charge: x })
            )}
          </div>
          <div>
            <label className={label}>
              {tr.internetFee} ({currency})
            </label>
            {numInput(cfg.internet_fee, (x) => setCfg({ ...cfg, internet_fee: x }))}
          </div>
          <div>
            <label className={label}>
              {tr.parkingFee} ({currency})
            </label>
            {numInput(cfg.parking_fee, (x) => setCfg({ ...cfg, parking_fee: x }))}
          </div>
          <div>
            <label className={label}>{tr.billingDay}</label>
            {numInput(cfg.billing_day, (x) => setCfg({ ...cfg, billing_day: x }))}
          </div>
          <div>
            <label className={label}>{tr.startMeterE}</label>
            {numInput(cfg.start_meter_electric, (x) =>
              setCfg({ ...cfg, start_meter_electric: x })
            )}
          </div>
          <div>
            <label className={label}>{tr.startMeterW}</label>
            {numInput(cfg.start_meter_water, (x) =>
              setCfg({ ...cfg, start_meter_water: x })
            )}
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

        {/* 4. Generate bill (structured) */}
        <div className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Receipt size={15} /> {tr.genBill}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr.periodStart}</label>
              <input
                type="date"
                className={field}
                value={bill.periodStart}
                onChange={(e) => setBill({ ...bill, periodStart: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>{tr.periodEnd}</label>
              <input
                type="date"
                className={field}
                value={bill.periodEnd}
                onChange={(e) => setBill({ ...bill, periodEnd: e.target.value })}
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
              <label className={label}>{tr.prevE}</label>
              {numInput(bill.electricPrev, (x) => setBill({ ...bill, electricPrev: x }), "text-right")}
            </div>
            <div>
              <label className={label}>{tr.newE}</label>
              {numInput(bill.electricCurr, (x) => setBill({ ...bill, electricCurr: x }), "text-right")}
            </div>
            <div>
              <label className={label}>{tr.prevW}</label>
              {numInput(bill.waterPrev, (x) => setBill({ ...bill, waterPrev: x }), "text-right")}
            </div>
            <div>
              <label className={label}>{tr.newW}</label>
              {numInput(bill.waterCurr, (x) => setBill({ ...bill, waterCurr: x }), "text-right")}
            </div>
            <div>
              <label className={label}>
                {tr.internet} ({currency})
              </label>
              {numInput(bill.internet, (x) => setBill({ ...bill, internet: x }), "text-right")}
            </div>
            <div>
              <label className={label}>
                {tr.parking} ({currency})
              </label>
              {numInput(bill.parking, (x) => setBill({ ...bill, parking: x }), "text-right")}
            </div>
          </div>

          {/* live preview */}
          <dl className="mt-4 space-y-1.5 border-t border-[var(--app-border)] pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.rent}</dt>
              <dd>{money(n(bill.rent))}</dd>
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
            {billCalc.internet_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{tr.internet}</dt>
                <dd>{money(billCalc.internet_amount)}</dd>
              </div>
            )}
            {billCalc.parking_amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{tr.parking}</dt>
                <dd>{money(billCalc.parking_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.other}</dt>
              <dd>{money(n(bill.other))}</dd>
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

      {/* ── 6b. Co-tenants ─────────────────────────────────────────────────── */}
      <div className={`${card} mb-5`}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users size={15} /> {tr.coTenants}
          </h2>
          <Button size="sm" onClick={openCo}>
            <Plus size={14} /> {tr.addCoTenant}
          </Button>
        </div>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{tr.coTenantsHint}</p>

        {coTenants.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title={tr.noCoTenants} />
        ) : (
          <ul className="divide-y divide-[var(--app-border)]">
            {coTenants.map((c) => (
              <li key={c.bookingId} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">{c.guestName}</span>
                {c.phone && (
                  <span className="text-sm text-[var(--app-fg-muted)]">{c.phone}</span>
                )}
                <span className="text-sm text-[var(--app-fg-muted)]">{money(c.monthlyRent)}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => router.push("/app/rentals/" + c.bookingId)}
                    className="inline-flex h-8 items-center rounded-xl border border-[var(--app-border)] px-3 text-xs font-medium transition-colors hover:bg-[var(--app-surface-2)]"
                  >
                    {tr.open}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveCoTenant(c.bookingId)}
                    aria-label={tr.delete}
                    disabled={coRemoving === c.bookingId}
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
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        {/* Adjustment lines — each can deduct (+) or credit (−) the refund. */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className={label + " mb-0"}>{tr.adjustments}</label>
            <button
              type="button"
              onClick={addAdjust}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-surface-2)]"
            >
              <Plus size={13} /> {tr.addAdjust}
            </button>
          </div>
          {mo.items.length > 0 && (
            <div className="space-y-2">
              {mo.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={`${field} flex-1`}
                    placeholder={tr.adjustLabel}
                    value={it.label}
                    onChange={(e) => setAdjust(it.id, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className={`${field} w-28 text-right`}
                    placeholder={tr.adjustAmount}
                    value={it.amount}
                    onChange={(e) =>
                      setAdjust(it.id, { amount: e.target.value === "" ? "" : Number(e.target.value) })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeAdjust(it.id)}
                    aria-label={tr.removeItem}
                    title={tr.removeItem}
                    className="flex-none rounded-lg p-2 text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-[var(--app-fg-muted)]">{tr.adjustHint}</p>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-[var(--app-border)] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--app-fg-muted)]">{tr.held}</dt>
            <dd>{money(settlement.held)}</dd>
          </div>
          {(rentalTenant?.advance_rent ?? 0) > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.advanceConsumed}</dt>
              <dd>{signedDeduct(rentalTenant?.advance_rent ?? 0)}</dd>
            </div>
          )}
          {n(mo.electric) !== 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.finalElectric}</dt>
              <dd>{signedDeduct(n(mo.electric))}</dd>
            </div>
          )}
          {n(mo.water) !== 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--app-fg-muted)]">{tr.finalWater}</dt>
              <dd>{signedDeduct(n(mo.water))}</dd>
            </div>
          )}
          {mo.items
            .filter((it) => n(it.amount) !== 0 || it.label.trim() !== "")
            .map((it) => (
              <div key={it.id} className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{it.label.trim() || tr.adjustLabel}</dt>
                <dd>{signedDeduct(n(it.amount))}</dd>
              </div>
            ))}
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

      {/* ── Add co-tenant modal ────────────────────────────────────────────── */}
      <Modal
        open={coOpen}
        onClose={() => setCoOpen(false)}
        title={tr.addCoTenant}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCoOpen(false)}>
              {tr.cancel}
            </Button>
            <Button onClick={onAddCoTenant} loading={coBusy}>
              {tr.addCoTenant}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--app-fg-muted)]">{tr.coTenantsHint}</p>
          <div>
            <label className={label}>{tr.coName}</label>
            <input
              className={field}
              value={coForm.name}
              onChange={(e) => setCoForm({ ...coForm, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tr.coPhone}</label>
              <input
                className={field}
                value={coForm.phone}
                onChange={(e) => setCoForm({ ...coForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>
                {tr.coRent} ({currency})
              </label>
              {numInput(coForm.rent, (x) => setCoForm({ ...coForm, rent: x }))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Bulk meter modal ───────────────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={tr.bulkMeterTitle}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              {tr.cancel}
            </Button>
            <Button onClick={onSaveBulk} loading={bulkBusy}>
              {tr.bulkSave}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="max-w-[220px]">
            <label className={label}>{tr.bulkDate}</label>
            <input
              type="date"
              className={field}
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="py-2 pr-2 font-medium">{tr.room}</th>
                  <th className="py-2 px-2 font-medium">{tr.tenant}</th>
                  <th className="py-2 px-2 text-right font-medium">{tr.prevE}</th>
                  <th className="py-2 px-2 text-right font-medium">{tr.newE}</th>
                  <th className="py-2 px-2 text-right font-medium">{tr.prevW}</th>
                  <th className="py-2 px-2 text-right font-medium">{tr.newW}</th>
                </tr>
              </thead>
              <tbody>
                {bulkTenants.map((t) => {
                  const row = bulkRows[t.bookingId] ?? { electric: "" as Num, water: "" as Num };
                  return (
                    <tr key={t.bookingId} className="border-t border-[var(--app-border)]">
                      <td className="py-2 pr-2 font-medium whitespace-nowrap">{t.roomNumber}</td>
                      <td className="py-2 px-2 max-w-[140px] truncate">{t.guestName}</td>
                      <td className="py-2 px-2 text-right text-[var(--app-fg-muted)] whitespace-nowrap">
                        {t.prevElectric ?? "—"}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          className={`${field} text-right`}
                          value={row.electric}
                          onChange={(e) =>
                            setBulkRows((s) => ({
                              ...s,
                              [t.bookingId]: {
                                ...row,
                                electric: e.target.value === "" ? "" : Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 px-2 text-right text-[var(--app-fg-muted)] whitespace-nowrap">
                        {t.prevWater ?? "—"}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          className={`${field} text-right`}
                          value={row.water}
                          onChange={(e) =>
                            setBulkRows((s) => ({
                              ...s,
                              [t.bookingId]: {
                                ...row,
                                water: e.target.value === "" ? "" : Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
