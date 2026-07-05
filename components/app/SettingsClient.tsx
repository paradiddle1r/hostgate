"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sparkles,
  Plus,
  Lock,
  Receipt,
  ImagePlus,
  Trash2,
  MapPin,
  KeyRound,
  Printer,
  Landmark,
  Type,
  Clock,
  Link2,
  Copy,
  Check,
  Code2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import type { Property } from "@/lib/db/properties";
import { useAppT } from "@/lib/app-i18n";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { planLimits, canAddProperty } from "@/lib/plan";
import {
  savePropertyDetails,
  addProperty,
  saveBilling,
  savePropertyProfile,
  saveAppearancePrefs,
} from "@/app/app/actions";
import { importOtaIcal } from "@/app/app/settings/actions";

const field =
  "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

// Local TH+EN strings. Keeps us out of lib/app-i18n.ts.
const BILL = {
  th: {
    heading: "ออกใบกำกับ",
    legalName: "ชื่อนิติบุคคล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    billingAddress: "ที่อยู่ออกใบกำกับ",
    vatRate: "อัตรา VAT (%)",
    vatInclusive: "ราคารวม VAT แล้ว",
    bankName: "ธนาคาร",
    bankAccount: "เลขที่บัญชี",
    invoicePrefix: "คำนำหน้าเลขที่เอกสาร",
    invoiceFooter: "ข้อความท้ายใบกำกับ",
  },
  en: {
    heading: "Billing",
    legalName: "Legal name",
    taxId: "Tax ID",
    billingAddress: "Billing address",
    vatRate: "VAT rate (%)",
    vatInclusive: "Prices include VAT",
    bankName: "Bank name",
    bankAccount: "Bank account",
    invoicePrefix: "Invoice prefix",
    invoiceFooter: "Invoice footer",
  },
} as const;

const CO = {
  th: {
    company: "ข้อมูลบริษัท (ฉบับภาษาไทย)",
    companyHint: "ใช้บนใบกำกับ/ใบเสร็จ — เว้นว่างได้ ระบบจะใช้ค่าภาษาอังกฤษแทน",
    legalNameTh: "ชื่อนิติบุคคล (TH)",
    tradingName: "ชื่อทางการค้า",
    tradingNameTh: "ชื่อทางการค้า (TH)",
    branch: "สาขา",
    branchTh: "สาขา (TH)",
    registrationNo: "เลขทะเบียนนิติบุคคล",
    address: "ที่อยู่",
    addressHint: "ที่อยู่แยกบรรทัด สำหรับใบกำกับภาษีตามรูปแบบกรมสรรพากร",
    line1: "ที่อยู่บรรทัด 1",
    line2: "ที่อยู่บรรทัด 2",
    line1Th: "ที่อยู่บรรทัด 1 (TH)",
    line2Th: "ที่อยู่บรรทัด 2 (TH)",
    subdistrict: "ตำบล / แขวง",
    district: "อำเภอ / เขต",
    province: "จังหวัด",
    postalCode: "รหัสไปรษณีย์",
    contact: "ข้อมูลติดต่อ",
    phone: "โทรศัพท์",
    email: "อีเมล",
    website: "เว็บไซต์",
    branding: "โลโก้",
    uploadLogo: "อัปโหลดโลโก้",
    uploaded: "อัปโหลดแล้ว — กดบันทึกข้อมูลบริษัทเพื่อจัดเก็บ",
    remove: "ลบ",
    logoUrl: "ลิงก์โลโก้ (URL)",
    bankExtra: "รายละเอียดธนาคารเพิ่มเติม",
    bankBranch: "สาขาธนาคาร",
    bankAccountName: "ชื่อบัญชี",
    print: "ค่าเริ่มต้นการพิมพ์",
    paperSize: "ขนาดกระดาษ",
    printMode: "โหมดการพิมพ์",
    landlord: "ผู้ให้เช่า (ใช้ในสัญญาเช่า)",
    landlordHint: "เติมข้อมูลผู้ให้เช่าในสัญญาเช่าใหม่อัตโนมัติ",
    landlordName: "ชื่อผู้ให้เช่า",
    landlordNameTh: "ชื่อผู้ให้เช่า (TH)",
    landlordCompany: "บริษัทผู้ให้เช่า",
    landlordCompanyTh: "บริษัทผู้ให้เช่า (TH)",
    landlordTaxId: "เลขประจำตัวผู้เสียภาษี/บัตรประชาชน",
    landlordAddress: "ที่อยู่ผู้ให้เช่า",
    landlordAddressTh: "ที่อยู่ผู้ให้เช่า (TH)",
    landlordPhone: "โทรศัพท์ผู้ให้เช่า",
    appearance: "การแสดงผล",
    appearanceHint: "บันทึกเป็นค่าส่วนตัวของคุณ",
    fontSize: "ขนาดตัวอักษร",
    timeFormat: "รูปแบบเวลา",
    sm: "เล็ก",
    normal: "ปกติ",
    lg: "ใหญ่",
    h12: "12 ชั่วโมง",
    h24: "24 ชั่วโมง",
    saveCompany: "บันทึกข้อมูลบริษัท",
    saveAppearance: "บันทึก",
  },
  en: {
    company: "Company profile (Thai)",
    companyHint: "Appears on tax invoices / receipts — leave blank to fall back to the English value",
    legalNameTh: "Legal name (TH)",
    tradingName: "Trading name",
    tradingNameTh: "Trading name (TH)",
    branch: "Branch",
    branchTh: "Branch (TH)",
    registrationNo: "Registration no.",
    address: "Address",
    addressHint: "Structured address lines for Thai Revenue Department tax-invoice format",
    line1: "Address line 1",
    line2: "Address line 2",
    line1Th: "Address line 1 (TH)",
    line2Th: "Address line 2 (TH)",
    subdistrict: "Subdistrict",
    district: "District",
    province: "Province",
    postalCode: "Postal code",
    contact: "Identity & contact",
    phone: "Phone",
    email: "Email",
    website: "Website",
    branding: "Logo",
    uploadLogo: "Upload logo",
    uploaded: "Uploaded — click Save company profile to keep it",
    remove: "Remove",
    logoUrl: "Logo URL",
    bankExtra: "Bank details",
    bankBranch: "Bank branch",
    bankAccountName: "Account name",
    print: "Print defaults",
    paperSize: "Paper size",
    printMode: "Print mode",
    landlord: "Landlord (used on rental contracts)",
    landlordHint: "Pre-fills the landlord block on every new rental contract draft",
    landlordName: "Landlord name",
    landlordNameTh: "Landlord name (TH)",
    landlordCompany: "Landlord company",
    landlordCompanyTh: "Landlord company (TH)",
    landlordTaxId: "Landlord tax / ID number",
    landlordAddress: "Landlord address",
    landlordAddressTh: "Landlord address (TH)",
    landlordPhone: "Landlord phone",
    appearance: "Appearance",
    appearanceHint: "Saved as your personal preference",
    fontSize: "Font size",
    timeFormat: "Time format",
    sm: "Small",
    normal: "Normal",
    lg: "Large",
    h12: "12-hour",
    h24: "24-hour",
    saveCompany: "Save company profile",
    saveAppearance: "Save",
  },
} as const;

const WIDGET = {
  th: {
    hint: "แชร์ลิงก์นี้ให้แขกจองห้องพักโดยตรงกับคุณ ไม่ผ่านคอมมิชชั่น OTA",
    previewCaption: "โลโก้ด้านบน (ในหัวข้อ “ข้อมูลบริษัท”) จะแสดงบนหัวหน้าเว็บจองตรงของคุณด้วย",
    linkLabel: "ลิงก์จองของคุณ",
    copy: "คัดลอกลิงก์",
    copied: "คัดลอกแล้ว",
    embedToggle: "ฝังลงเว็บไซต์ของคุณ",
    embedLinkLabel: "โค้ดปุ่มลิงก์ (a href)",
    embedIframeLabel: "โค้ดฝังแบบเต็มหน้า (iframe)",
    copySnippet: "คัดลอกโค้ด",
  },
  en: {
    hint: "Share this link so guests can book directly with you — no OTA commission.",
    previewCaption: "The logo above (in “Company profile”) also appears in the header of your public booking page.",
    linkLabel: "Your booking link",
    copy: "Copy link",
    copied: "Copied",
    embedToggle: "Embed on your website",
    embedLinkLabel: "Link button snippet (<a href>)",
    embedIframeLabel: "Full-page embed snippet (<iframe>)",
    copySnippet: "Copy code",
  },
} as const;

const ICAL = {
  th: {
    heading: "ซิงก์ปฏิทิน OTA (iCal)",
    hint: "คัดลอกลิงก์ของแต่ละประเภทห้องพัก ไปวางในช่องซิงก์ปฏิทิน (Sync Calendar / iCal URL) ของ Booking.com, Agoda หรือ Airbnb เพื่อให้ระบบเหล่านั้นเห็นการจองที่มีอยู่แล้วใน HostGate และไม่ขายห้องซ้ำ",
    copy: "คัดลอกลิงก์",
    copied: "คัดลอกแล้ว",
    empty: "ยังไม่มีประเภทห้องพัก — เพิ่มที่หน้าห้องพักก่อน",
    importHeading: "นำเข้าจาก OTA",
    importHint: "วางลิงก์ปฏิทิน iCal (.ics) จาก Booking.com, Agoda หรือ Airbnb เพื่อดึงวันที่ถูกจองไว้แล้วในระบบเหล่านั้น มาบล็อกในปฏิทินของ HostGate โดยอัตโนมัติ ป้องกันไม่ให้หน้าจองตรงขายห้องซ้ำ ซิงก์ซ้ำได้ปลอดภัย ระบบจะข้ามรายการที่นำเข้าไปแล้ว",
    urlPlaceholder: "วางลิงก์ iCal (.ics) จาก OTA ที่นี่",
    sync: "ซิงก์เดี๋ยวนี้",
    syncResult: (imported: number, skipped: number) =>
      `นำเข้า ${imported} รายการ, ข้าม ${skipped} รายการ (ซิงก์ซ้ำ)`,
  },
  en: {
    heading: "OTA calendar sync (iCal)",
    hint: "Copy each room type's link into Booking.com / Agoda / Airbnb's calendar-sync (iCal URL) settings so it sees bookings already in HostGate and stops double-selling the room.",
    copy: "Copy link",
    copied: "Copied",
    empty: "No room types yet — add one on the Rooms page first.",
    importHeading: "Import from OTA",
    importHint: "Paste an OTA's iCal (.ics) calendar-sync link (Booking.com / Agoda / Airbnb) to pull in dates already booked there and auto-block them on HostGate's calendar — stops the direct-booking widget from double-selling the room. Safe to re-sync — already-imported dates are skipped.",
    urlPlaceholder: "Paste the OTA's iCal (.ics) link here",
    sync: "Sync now",
    syncResult: (imported: number, skipped: number) =>
      `Imported ${imported}, skipped ${skipped} (already synced)`,
  },
} as const;

const PAPER_SIZES = ["A4", "A5", "Letter", "Slip"];
const PRINT_MODES = ["invoice", "inkjet", "dotmatrix"];

export default function SettingsClient({
  property,
  plan,
  propertyCount,
  fontSize = "normal",
  timeFormat = "24h",
  roomTypes = [],
}: {
  property: Property;
  plan: string;
  propertyCount: number;
  fontSize?: string;
  timeFormat?: string;
  roomTypes?: { id: string; name: string }[];
}) {
  const t = useAppT();
  const { locale } = useI18n();
  const en = locale === "en";
  const bt = BILL[en ? "en" : "th"];
  const c = CO[en ? "en" : "th"];
  const w = WIDGET[en ? "en" : "th"];
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
  const [billing, setBilling] = useState({
    legal_name: property.legal_name ?? "",
    tax_id: property.tax_id ?? "",
    billing_address: property.billing_address ?? "",
    vat_rate: String(property.vat_rate ?? 0),
    vat_inclusive: property.vat_inclusive ?? false,
    bank_name: property.bank_name ?? "",
    bank_account: property.bank_account ?? "",
    invoice_prefix: property.invoice_prefix ?? "",
    invoice_footer: property.invoice_footer ?? "",
  });

  // Full company-profile block (migration 15).
  const [co, setCo] = useState({
    logo_url: property.logo_url ?? "",
    legal_name_th: property.legal_name_th ?? "",
    trading_name: property.trading_name ?? "",
    trading_name_th: property.trading_name_th ?? "",
    branch: property.branch ?? "",
    branch_th: property.branch_th ?? "",
    registration_no: property.registration_no ?? "",
    address_line1: property.address_line1 ?? "",
    address_line2: property.address_line2 ?? "",
    address_line1_th: property.address_line1_th ?? "",
    address_line2_th: property.address_line2_th ?? "",
    subdistrict: property.subdistrict ?? "",
    district: property.district ?? "",
    province: property.province ?? "",
    postal_code: property.postal_code ?? "",
    phone: property.phone ?? "",
    email: property.email ?? "",
    website: property.website ?? "",
    bank_branch: property.bank_branch ?? "",
    bank_account_name: property.bank_account_name ?? "",
    default_paper_size: property.default_paper_size ?? "A4",
    default_print_mode: property.default_print_mode ?? "invoice",
    landlord_name: property.landlord_name ?? "",
    landlord_name_th: property.landlord_name_th ?? "",
    landlord_company: property.landlord_company ?? "",
    landlord_company_th: property.landlord_company_th ?? "",
    landlord_tax_id: property.landlord_tax_id ?? "",
    landlord_address: property.landlord_address ?? "",
    landlord_address_th: property.landlord_address_th ?? "",
    landlord_phone: property.landlord_phone ?? "",
  });
  const setCoField = (patch: Partial<typeof co>) => setCo((s) => ({ ...s, ...patch }));

  const [appearance, setAppearance] = useState({ font_size: fontSize, time_format: timeFormat });

  const [savingBilling, setSavingBilling] = useState(false);
  const [savingCo, setSavingCo] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", property_type: "daily" as const, city: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Direct-booking widget (Settings only — derived from property.code/logo_url,
  // no new DB column). Falls back to the production origin during SSR/first
  // paint, then corrects to the real origin on mount (avoids a hydration
  // mismatch while still working on preview/localhost deployments).
  const [origin, setOrigin] = useState("https://hostgate.app");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const bookingUrl = `${origin}/book/${property.code}`;
  const embedLinkSnippet = `<a href="${bookingUrl}" target="_blank" rel="noopener">${form.name || property.name}</a>`;
  const embedIframeSnippet = `<iframe src="${bookingUrl}" title="${form.name || property.name}" style="width:100%;height:800px;border:0" loading="lazy"></iframe>`;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<"link" | "iframe" | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [copiedIcalId, setCopiedIcalId] = useState<string | null>(null);
  const [importUrls, setImportUrls] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function copyToClipboard(text: string, onDone: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
      toast.success(w.copied);
    } catch {
      toast.error(en ? "Copy failed" : "คัดลอกไม่สำเร็จ");
    }
  }

  function copyBookingLink() {
    copyToClipboard(bookingUrl, () => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  function copyEmbedSnippet(kind: "link" | "iframe") {
    copyToClipboard(kind === "link" ? embedLinkSnippet : embedIframeSnippet, () => {
      setCopiedSnippet(kind);
      setTimeout(() => setCopiedSnippet((s) => (s === kind ? null : s)), 2000);
    });
  }

  function icalUrl(roomTypeId: string): string {
    return `${origin}/ical/${property.code}/${roomTypeId}`;
  }

  function copyIcalLink(roomTypeId: string) {
    copyToClipboard(icalUrl(roomTypeId), () => {
      setCopiedIcalId(roomTypeId);
      setTimeout(() => setCopiedIcalId((s) => (s === roomTypeId ? null : s)), 2000);
    });
  }

  // Pull an OTA's .ics feed for one room type and auto-block those dates.
  // Safe to click repeatedly — importOtaIcal() skips UIDs already imported.
  async function syncOtaImport(roomTypeId: string) {
    const ical = ICAL[en ? "en" : "th"];
    const url = (importUrls[roomTypeId] ?? "").trim();
    if (!url) return;
    setSyncingId(roomTypeId);
    const res = await importOtaIcal(roomTypeId, url);
    setSyncingId(null);
    if (res.ok) {
      toast.success(ical.syncResult(res.data.imported, res.data.skipped));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

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

  async function saveBillingDetails() {
    setSavingBilling(true);
    const vat = Number(billing.vat_rate);
    const res = await saveBilling({
      legal_name: billing.legal_name.trim() || null,
      tax_id: billing.tax_id.trim() || null,
      billing_address: billing.billing_address.trim() || null,
      vat_rate: Number.isFinite(vat) ? vat : 0,
      vat_inclusive: billing.vat_inclusive,
      bank_name: billing.bank_name.trim() || null,
      bank_account: billing.bank_account.trim() || null,
      invoice_prefix: billing.invoice_prefix.trim(),
      invoice_footer: billing.invoice_footer.trim() || null,
    });
    setSavingBilling(false);
    if (res.ok) {
      toast.success(t("settings.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  // Normalize the company block — empty strings → null so we don't store "".
  function nz(v: string): string | null {
    const x = v.trim();
    return x === "" ? null : x;
  }

  async function saveCompany() {
    setSavingCo(true);
    const res = await savePropertyProfile({
      logo_url: nz(co.logo_url),
      legal_name_th: nz(co.legal_name_th),
      trading_name: nz(co.trading_name),
      trading_name_th: nz(co.trading_name_th),
      branch: nz(co.branch),
      branch_th: nz(co.branch_th),
      registration_no: nz(co.registration_no),
      address_line1: nz(co.address_line1),
      address_line2: nz(co.address_line2),
      address_line1_th: nz(co.address_line1_th),
      address_line2_th: nz(co.address_line2_th),
      subdistrict: nz(co.subdistrict),
      district: nz(co.district),
      province: nz(co.province),
      postal_code: nz(co.postal_code),
      phone: nz(co.phone),
      email: nz(co.email),
      website: nz(co.website),
      bank_branch: nz(co.bank_branch),
      bank_account_name: nz(co.bank_account_name),
      default_paper_size: co.default_paper_size,
      default_print_mode: co.default_print_mode,
      landlord_name: nz(co.landlord_name),
      landlord_name_th: nz(co.landlord_name_th),
      landlord_company: nz(co.landlord_company),
      landlord_company_th: nz(co.landlord_company_th),
      landlord_tax_id: nz(co.landlord_tax_id),
      landlord_address: nz(co.landlord_address),
      landlord_address_th: nz(co.landlord_address_th),
      landlord_phone: nz(co.landlord_phone),
    });
    setSavingCo(false);
    if (res.ok) {
      toast.success(t("settings.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function saveAppearance() {
    setSavingAppearance(true);
    const res = await saveAppearancePrefs(appearance);
    setSavingAppearance(false);
    if (res.ok) {
      toast.success(t("settings.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  // Logo upload → company-assets bucket, path prefixed with property.id so
  // tenants can't clobber each other's logos. We store the public URL in
  // logo_url (committed when the user clicks Save company profile).
  async function uploadLogo(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${property.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
      setCoField({ logo_url: data?.publicUrl ?? "" });
      toast.success(c.uploaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploading(false);
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

      {/* Company profile — logo + Thai mirror + identity */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-1 flex items-center gap-2">
          <Building2 size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{c.company}</h2>
        </div>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{c.companyHint}</p>

        {/* Branding / logo */}
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)]">
            {co.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={co.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={28} className="opacity-40" />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadLogo(e.target.files?.[0])}
            />
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImagePlus size={15} /> {c.uploadLogo}
              </Button>
              {co.logo_url && (
                <Button variant="ghost" onClick={() => setCoField({ logo_url: "" })}>
                  <Trash2 size={15} /> {c.remove}
                </Button>
              )}
            </div>
            <div className="mt-2">
              <label className={label}>{c.logoUrl}</label>
              <input
                className={field}
                value={co.logo_url}
                placeholder="https://…"
                onChange={(e) => setCoField({ logo_url: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{c.legalNameTh}</label>
            <input className={field} value={co.legal_name_th} onChange={(e) => setCoField({ legal_name_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.registrationNo}</label>
            <input className={field} value={co.registration_no} onChange={(e) => setCoField({ registration_no: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.tradingName}</label>
            <input className={field} value={co.trading_name} onChange={(e) => setCoField({ trading_name: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.tradingNameTh}</label>
            <input className={field} value={co.trading_name_th} onChange={(e) => setCoField({ trading_name_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.branch}</label>
            <input className={field} value={co.branch} onChange={(e) => setCoField({ branch: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.branchTh}</label>
            <input className={field} value={co.branch_th} onChange={(e) => setCoField({ branch_th: e.target.value })} />
          </div>
        </div>

        {/* Structured address + Thai mirror */}
        <div className="mt-5 mb-1 flex items-center gap-2">
          <MapPin size={16} className="text-[var(--app-accent)]" />
          <h3 className="text-sm font-semibold">{c.address}</h3>
        </div>
        <p className="mb-3 text-xs text-[var(--app-fg-muted)]">{c.addressHint}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{c.line1}</label>
            <input className={field} value={co.address_line1} onChange={(e) => setCoField({ address_line1: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.line2}</label>
            <input className={field} value={co.address_line2} onChange={(e) => setCoField({ address_line2: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.line1Th}</label>
            <input className={field} value={co.address_line1_th} onChange={(e) => setCoField({ address_line1_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.line2Th}</label>
            <input className={field} value={co.address_line2_th} onChange={(e) => setCoField({ address_line2_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.subdistrict}</label>
            <input className={field} value={co.subdistrict} onChange={(e) => setCoField({ subdistrict: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.district}</label>
            <input className={field} value={co.district} onChange={(e) => setCoField({ district: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.province}</label>
            <input className={field} value={co.province} onChange={(e) => setCoField({ province: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.postalCode}</label>
            <input className={field} value={co.postal_code} onChange={(e) => setCoField({ postal_code: e.target.value })} />
          </div>
        </div>

        {/* Identity / contact */}
        <div className="mt-5 mb-3 flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--app-accent)]" />
          <h3 className="text-sm font-semibold">{c.contact}</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>{c.phone}</label>
            <input className={field} value={co.phone} onChange={(e) => setCoField({ phone: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.email}</label>
            <input className={field} type="email" value={co.email} onChange={(e) => setCoField({ email: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.website}</label>
            <input className={field} value={co.website} onChange={(e) => setCoField({ website: e.target.value })} />
          </div>
        </div>

        {/* Bank extras */}
        <div className="mt-5 mb-3 flex items-center gap-2">
          <Landmark size={16} className="text-[var(--app-accent)]" />
          <h3 className="text-sm font-semibold">{c.bankExtra}</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{c.bankBranch}</label>
            <input className={field} value={co.bank_branch} onChange={(e) => setCoField({ bank_branch: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.bankAccountName}</label>
            <input className={field} value={co.bank_account_name} onChange={(e) => setCoField({ bank_account_name: e.target.value })} />
          </div>
        </div>

        {/* Print defaults */}
        <div className="mt-5 mb-3 flex items-center gap-2">
          <Printer size={16} className="text-[var(--app-accent)]" />
          <h3 className="text-sm font-semibold">{c.print}</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{c.paperSize}</label>
            <select className={field} value={co.default_paper_size} onChange={(e) => setCoField({ default_paper_size: e.target.value })}>
              {PAPER_SIZES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{c.printMode}</label>
            <select className={field} value={co.default_print_mode} onChange={(e) => setCoField({ default_print_mode: e.target.value })}>
              {PRINT_MODES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Landlord block */}
        <div className="mt-5 mb-1 flex items-center gap-2">
          <Building2 size={16} className="text-[var(--app-accent)]" />
          <h3 className="text-sm font-semibold">{c.landlord}</h3>
        </div>
        <p className="mb-3 text-xs text-[var(--app-fg-muted)]">{c.landlordHint}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{c.landlordName}</label>
            <input className={field} value={co.landlord_name} onChange={(e) => setCoField({ landlord_name: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordNameTh}</label>
            <input className={field} value={co.landlord_name_th} onChange={(e) => setCoField({ landlord_name_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordCompany}</label>
            <input className={field} value={co.landlord_company} onChange={(e) => setCoField({ landlord_company: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordCompanyTh}</label>
            <input className={field} value={co.landlord_company_th} onChange={(e) => setCoField({ landlord_company_th: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{c.landlordTaxId}</label>
            <input className={field} value={co.landlord_tax_id} onChange={(e) => setCoField({ landlord_tax_id: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordAddress}</label>
            <input className={field} value={co.landlord_address} onChange={(e) => setCoField({ landlord_address: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordAddressTh}</label>
            <input className={field} value={co.landlord_address_th} onChange={(e) => setCoField({ landlord_address_th: e.target.value })} />
          </div>
          <div>
            <label className={label}>{c.landlordPhone}</label>
            <input className={field} value={co.landlord_phone} onChange={(e) => setCoField({ landlord_phone: e.target.value })} />
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={saveCompany} loading={savingCo}>
            {c.saveCompany}
          </Button>
        </div>
      </section>

      {/* Direct booking widget — read-only, derived from property.code/logo_url */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-1 flex items-center gap-2">
          <Link2 size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">
            {en ? "Direct booking link" : "ลิงก์จองตรง"}
            {!en && <span className="text-[var(--app-fg-muted)]"> / Direct booking link</span>}
          </h2>
        </div>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{w.hint}</p>

        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)]">
            {co.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={co.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={22} className="opacity-40" />
            )}
          </div>
          <p className="flex-1 text-xs text-[var(--app-fg-muted)]">{w.previewCaption}</p>
        </div>

        <div>
          <label className={label}>{w.linkLabel}</label>
          <div className="flex items-center gap-2">
            <input className={`${field} font-mono text-xs`} value={bookingUrl} readOnly onFocus={(e) => e.target.select()} />
            <Button variant="ghost" size="sm" onClick={copyBookingLink} className="shrink-0">
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? w.copied : w.copy}
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--app-border)] pt-4">
          <button
            type="button"
            onClick={() => setEmbedOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left text-sm font-medium"
          >
            <Code2 size={15} className="text-[var(--app-accent)]" />
            {w.embedToggle}
            <ChevronDown
              size={15}
              className={`ml-auto text-[var(--app-fg-muted)] transition-transform ${embedOpen ? "rotate-180" : ""}`}
            />
          </button>

          {embedOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <label className={label}>{w.embedLinkLabel}</label>
                <div className="flex items-center gap-2">
                  <textarea
                    readOnly
                    className={`${field} min-h-[52px] resize-none font-mono text-xs`}
                    value={embedLinkSnippet}
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="ghost" size="sm" onClick={() => copyEmbedSnippet("link")} className="shrink-0">
                    {copiedSnippet === "link" ? <Check size={14} /> : <Copy size={14} />}
                    {w.copySnippet}
                  </Button>
                </div>
              </div>
              <div>
                <label className={label}>{w.embedIframeLabel}</label>
                <div className="flex items-center gap-2">
                  <textarea
                    readOnly
                    className={`${field} min-h-[52px] resize-none font-mono text-xs`}
                    value={embedIframeSnippet}
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="ghost" size="sm" onClick={() => copyEmbedSnippet("iframe")} className="shrink-0">
                    {copiedSnippet === "iframe" ? <Check size={14} /> : <Copy size={14} />}
                    {w.copySnippet}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* OTA calendar sync — read-only per-room-type iCal export URLs */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-1 flex items-center gap-2">
          <RefreshCw size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{ICAL[en ? "en" : "th"].heading}</h2>
        </div>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{ICAL[en ? "en" : "th"].hint}</p>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{ICAL[en ? "en" : "th"].importHint}</p>

        {roomTypes.length === 0 ? (
          <p className="text-sm text-[var(--app-fg-muted)]">{ICAL[en ? "en" : "th"].empty}</p>
        ) : (
          <div className="space-y-3">
            {roomTypes.map((rt) => (
              <div key={rt.id}>
                <label className={label}>{rt.name}</label>
                <div className="flex items-center gap-2">
                  <input
                    className={`${field} font-mono text-xs`}
                    value={icalUrl(rt.id)}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyIcalLink(rt.id)}
                    className="shrink-0"
                  >
                    {copiedIcalId === rt.id ? <Check size={14} /> : <Copy size={14} />}
                    {copiedIcalId === rt.id ? ICAL[en ? "en" : "th"].copied : ICAL[en ? "en" : "th"].copy}
                  </Button>
                </div>

                {/* Import from OTA — reverse of the copy-link export above:
                    paste an external OTA .ics feed and auto-block its dates. */}
                <div className="mt-2 rounded-lg border border-dashed border-[var(--app-border)] p-2">
                  <label className={label}>{ICAL[en ? "en" : "th"].importHeading}</label>
                  <div className="flex items-center gap-2">
                    <input
                      className={`${field} font-mono text-xs`}
                      value={importUrls[rt.id] ?? ""}
                      placeholder={ICAL[en ? "en" : "th"].urlPlaceholder}
                      onChange={(e) => setImportUrls({ ...importUrls, [rt.id]: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncOtaImport(rt.id)}
                      loading={syncingId === rt.id}
                      disabled={!(importUrls[rt.id] ?? "").trim()}
                      className="shrink-0"
                    >
                      <RefreshCw size={14} />
                      {ICAL[en ? "en" : "th"].sync}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Billing / tax-invoice settings */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Receipt size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{bt.heading}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{bt.legalName}</label>
            <input
              className={field}
              value={billing.legal_name}
              onChange={(e) => setBilling({ ...billing, legal_name: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>{bt.taxId}</label>
            <input
              className={field}
              value={billing.tax_id}
              onChange={(e) => setBilling({ ...billing, tax_id: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{bt.billingAddress}</label>
            <textarea
              className={`${field} min-h-[72px] resize-y`}
              value={billing.billing_address}
              onChange={(e) => setBilling({ ...billing, billing_address: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>{bt.vatRate}</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className={field}
              value={billing.vat_rate}
              onChange={(e) => setBilling({ ...billing, vat_rate: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer select-none items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--app-accent)]"
                checked={billing.vat_inclusive}
                onChange={(e) => setBilling({ ...billing, vat_inclusive: e.target.checked })}
              />
              {bt.vatInclusive}
            </label>
          </div>
          <div>
            <label className={label}>{bt.bankName}</label>
            <input
              className={field}
              value={billing.bank_name}
              onChange={(e) => setBilling({ ...billing, bank_name: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>{bt.bankAccount}</label>
            <input
              className={field}
              value={billing.bank_account}
              onChange={(e) => setBilling({ ...billing, bank_account: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>{bt.invoicePrefix}</label>
            <input
              className={field}
              value={billing.invoice_prefix}
              onChange={(e) => setBilling({ ...billing, invoice_prefix: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{bt.invoiceFooter}</label>
            <textarea
              className={`${field} min-h-[72px] resize-y`}
              value={billing.invoice_footer}
              onChange={(e) => setBilling({ ...billing, invoice_footer: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveBillingDetails} loading={savingBilling}>
            {t("settings.save")}
          </Button>
        </div>
      </section>

      {/* Appearance — per-user font size + time format */}
      <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-1 flex items-center gap-2">
          <Type size={18} className="text-[var(--app-accent)]" />
          <h2 className="font-semibold">{c.appearance}</h2>
        </div>
        <p className="mb-4 text-xs text-[var(--app-fg-muted)]">{c.appearanceHint}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>
              <span className="inline-flex items-center gap-1.5">
                <Type size={13} /> {c.fontSize}
              </span>
            </label>
            <select
              className={field}
              value={appearance.font_size}
              onChange={(e) => setAppearance({ ...appearance, font_size: e.target.value })}
            >
              <option value="sm">{c.sm}</option>
              <option value="normal">{c.normal}</option>
              <option value="lg">{c.lg}</option>
            </select>
          </div>
          <div>
            <label className={label}>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} /> {c.timeFormat}
              </span>
            </label>
            <select
              className={field}
              value={appearance.time_format}
              onChange={(e) => setAppearance({ ...appearance, time_format: e.target.value })}
            >
              <option value="24h">{c.h24}</option>
              <option value="12h">{c.h12}</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveAppearance} loading={savingAppearance}>
            {c.saveAppearance}
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
