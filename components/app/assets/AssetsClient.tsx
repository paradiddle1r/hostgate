"use client";

// Fixed-asset register + straight-line depreciation (accounting Phase 6).
// Register table (filters + search + totals footer) → row click opens a
// schedule drawer (posted vs. projected schedule via scheduleFor()). "New
// asset" / editing a row opens a form modal with a live depreciation preview
// computed from lib/accounting/depreciation.ts. "Run depreciation" posts one
// combined draft GL entry per period via runDepreciationAction(). Mirrors the
// hotel-pms AssetsClient.jsx feature set, built on HostGate's Documents*
// conventions (Button/Modal/EmptyState/Toast, useI18n, ActionResult).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ExternalLink, Package, PlayCircle, Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import { scheduleFor, monthlyDepreciation, depreciableBase, bookValue } from "@/lib/accounting/depreciation";
import {
  loadAssetDetail,
  nextAssetCodeAction,
  createAssetAction,
  updateAssetAction,
  disposeAssetAction,
  runDepreciationAction,
} from "@/app/app/assets/actions";
import type {
  FixedAsset,
  AssetDepreciationLine,
  ChartAccountOption,
  CreateAssetInput,
  UpdateAssetInput,
  RunDepreciationResult,
  AssetStatus,
} from "@/lib/db/assets";

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STATUS_COLOR: Record<AssetStatus, string> = {
  active: "var(--app-success)",
  disposed: "var(--app-fg-muted)",
  "fully-depreciated": "var(--app-accent)",
};

const CATEGORY_PRESETS = ["Furniture", "Equipment", "Building", "Vehicle", "IT", "Other"];

const STR = {
  th: {
    title: "ทะเบียนสินทรัพย์ถาวร",
    count: "รายการ",
    search: "ค้นหารหัส / ชื่อ",
    newAsset: "สินทรัพย์ใหม่",
    runDep: "รันค่าเสื่อมราคา",
    all: "ทั้งหมด",
    statusActive: "ใช้งาน",
    statusDisposed: "จำหน่ายแล้ว",
    statusFully: "เสื่อมราคาเต็มแล้ว",
    code: "รหัส",
    name: "ชื่อ",
    category: "หมวดหมู่",
    acquiredDate: "วันที่ได้มา",
    cost: "ราคาทุน",
    accumDep: "ค่าเสื่อมสะสม",
    bookValue: "มูลค่าตามบัญชี",
    status: "สถานะ",
    totals: "รวม",
    empty: "ยังไม่มีสินทรัพย์",
    emptyHint: "เพิ่มสินทรัพย์ถาวรชิ้นแรกของคุณเพื่อเริ่มติดตามค่าเสื่อมราคา",
    editAsset: "แก้ไขสินทรัพย์",
    codeLabel: "รหัสสินทรัพย์",
    notes: "หมายเหตุ",
    acquired: "วันที่ได้มา",
    salvage: "มูลค่าซาก",
    life: "อายุการใช้งาน (เดือน)",
    coaAsset: "บัญชีสินทรัพย์",
    coaAccum: "บัญชีค่าเสื่อมราคาสะสม",
    coaAccumHint: 'เลือกบัญชี "ค่าเสื่อมราคาสะสม" (บัญชีหักลบสินทรัพย์)',
    coaExpense: "บัญชีค่าใช้จ่าย",
    pickAccount: "เลือกบัญชี…",
    preview: "ตัวอย่างค่าเสื่อมราคา",
    depBase: "มูลค่าคิดค่าเสื่อม",
    monthlyCharge: "ค่าเสื่อมรายเดือน",
    save2: "บันทึก",
    create: "สร้าง",
    cancel: "ยกเลิก",
    schedule: "ตารางค่าเสื่อมราคา",
    period: "งวด",
    amount: "จำนวนเงิน",
    accumulated: "สะสม",
    posted: "ลงบัญชีแล้ว",
    viewJournal: "ดูสมุดรายวัน",
    dispose: "จำหน่ายสินทรัพย์",
    disposeConfirm: "ยืนยันจำหน่ายสินทรัพย์นี้? การดำเนินการนี้จะทำเครื่องหมายว่าจำหน่ายแล้ว",
    runDepTitle: "รันค่าเสื่อมราคาประจำงวด",
    period2: "งวด (เดือน)",
    run: "รัน",
    resultAssets: "สินทรัพย์ที่ประมวลผล",
    resultLines: "รายการที่สร้าง",
    resultTotal: "ยอดรวม",
    alreadyApproved: "งวดนี้อนุมัติแล้ว ไม่สามารถรันซ้ำได้",
    close: "ปิด",
    saved: "บันทึกแล้ว",
  },
  en: {
    title: "Fixed asset register",
    count: "assets",
    search: "Search code / name",
    newAsset: "New asset",
    runDep: "Run depreciation",
    all: "All",
    statusActive: "Active",
    statusDisposed: "Disposed",
    statusFully: "Fully depreciated",
    code: "Code",
    name: "Name",
    category: "Category",
    acquiredDate: "Acquired",
    cost: "Cost",
    accumDep: "Accum. depreciation",
    bookValue: "Book value",
    status: "Status",
    totals: "Totals",
    empty: "No assets yet",
    emptyHint: "Add your first fixed asset to start tracking depreciation.",
    editAsset: "Edit asset",
    codeLabel: "Asset code",
    notes: "Notes",
    acquired: "Acquired date",
    salvage: "Salvage value",
    life: "Useful life (months)",
    coaAsset: "Asset account",
    coaAccum: "Accumulated-depreciation account",
    coaAccumHint: 'Pick the "accumulated depreciation" contra account.',
    coaExpense: "Expense account",
    pickAccount: "Pick an account…",
    preview: "Depreciation preview",
    depBase: "Depreciable base",
    monthlyCharge: "Monthly charge",
    save2: "Save",
    create: "Create",
    cancel: "Cancel",
    schedule: "Depreciation schedule",
    period: "Period",
    amount: "Amount",
    accumulated: "Accumulated",
    posted: "Posted",
    viewJournal: "View journal entry",
    dispose: "Dispose asset",
    disposeConfirm: "Dispose this asset? This marks it as disposed.",
    runDepTitle: "Run monthly depreciation",
    period2: "Period (month)",
    run: "Run",
    resultAssets: "Assets processed",
    resultLines: "Lines created",
    resultTotal: "Total amount",
    alreadyApproved: "This period is already approved and can't be re-run.",
    close: "Close",
    saved: "Saved",
  },
} as const;

// Both language tables share their keys; widen values to string so STR[lang]
// (a th|en union) is assignable where a single-locale table is expected.
type Tr = { [K in keyof (typeof STR)["en"]]: string };

const STATUS_FILTERS: (AssetStatus | "all")[] = ["all", "active", "disposed", "fully-depreciated"];

function statusLabel(tr: Tr, s: AssetStatus | "all"): string {
  if (s === "all") return tr.all;
  if (s === "active") return tr.statusActive;
  if (s === "disposed") return tr.statusDisposed;
  return tr.statusFully;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function AssetsClient({
  assets,
  coa,
  canApprove,
  currency,
}: {
  assets: FixedAsset[];
  coa: ChartAccountOption[];
  canApprove: boolean;
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const [status, setStatus] = useState<AssetStatus | "all">("all");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [scheduleAssetId, setScheduleAssetId] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  const money = (n: number) =>
    `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (!needle) return true;
      return a.code.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle);
    });
  }, [assets, status, q]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, a) => {
          acc.cost += Number(a.cost) || 0;
          acc.accum += Number(a.accum_depreciation) || 0;
          acc.book += bookValue(a);
          return acc;
        },
        { cost: 0, accum: 0, book: 0 }
      ),
    [rows]
  );

  const assetCoa = useMemo(() => coa.filter((c) => c.category === "asset"), [coa]);
  const expenseCoa = useMemo(() => coa.filter((c) => c.category === "expense"), [coa]);

  function openNew() {
    setEditingAsset(null);
    setFormOpen(true);
  }
  function openEdit(a: FixedAsset) {
    setEditingAsset(a);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length} {tr.count}
        </span>
        {canApprove && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRunOpen(true)}>
              <PlayCircle size={14} /> {tr.runDep}
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> {tr.newAsset}
            </Button>
          </div>
        )}
      </div>

      {/* Status filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
              status === s
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {statusLabel(tr, s)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr.search} className={`${field} pl-8`} />
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Package size={22} />}
            title={tr.empty}
            hint={tr.emptyHint}
            action={canApprove ? <Button size="sm" onClick={openNew}><Plus size={14} /> {tr.newAsset}</Button> : undefined}
          />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.code}</th>
                <th className="px-4 py-2.5 font-medium">{tr.name}</th>
                <th className="px-4 py-2.5 font-medium">{tr.category}</th>
                <th className="px-4 py-2.5 font-medium">{tr.acquiredDate}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.cost}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.accumDep}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.bookValue}</th>
                <th className="px-4 py-2.5 font-medium">{tr.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setScheduleAssetId(a.id)}
                  className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                >
                  <td className="px-4 py-2.5 font-medium">{a.code}</td>
                  <td className="px-4 py-2.5">{a.name}</td>
                  <td className="px-4 py-2.5 text-[var(--app-fg-muted)]">{a.category || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{a.acquired_date}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(a.cost)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(a.accum_depreciation)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">{money(bookValue(a))}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ background: STATUS_COLOR[a.status] }}
                    >
                      {statusLabel(tr, a.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--app-border)] font-semibold">
                <td className="px-4 py-2.5" colSpan={4}>
                  {tr.totals}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(totals.cost)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(totals.accum)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(totals.book)}</td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <AssetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        asset={editingAsset}
        assetCoa={assetCoa}
        expenseCoa={expenseCoa}
        tr={tr}
        money={money}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />

      <ScheduleDrawer
        assetId={scheduleAssetId}
        canApprove={canApprove}
        tr={tr}
        money={money}
        onClose={() => setScheduleAssetId(null)}
        onEdit={(a) => {
          setScheduleAssetId(null);
          openEdit(a);
        }}
        onDisposed={() => {
          setScheduleAssetId(null);
          router.refresh();
        }}
      />

      <RunDepreciationModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        tr={tr}
        money={money}
        onRan={() => router.refresh()}
      />
    </div>
  );
}

// ── New / Edit asset modal ─────────────────────────────────────────────────

function AssetFormModal({
  open,
  onClose,
  asset,
  assetCoa,
  expenseCoa,
  tr,
  money,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  asset: FixedAsset | null;
  assetCoa: ChartAccountOption[];
  expenseCoa: ChartAccountOption[];
  tr: Tr;
  money: (n: number) => string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!asset;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [acquiredDate, setAcquiredDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  const [salvage, setSalvage] = useState("");
  const [lifeMonths, setLifeMonths] = useState("");
  const [coaAsset, setCoaAsset] = useState("");
  const [coaAccum, setCoaAccum] = useState("");
  const [coaExpense, setCoaExpense] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (asset) {
      setCode(asset.code);
      setName(asset.name);
      setCategory(asset.category || "");
      setAcquiredDate(asset.acquired_date);
      setCost(String(asset.cost));
      setSalvage(String(asset.salvage));
      setLifeMonths(String(asset.useful_life_months));
      setCoaAsset(asset.coa_asset_code);
      setCoaAccum(asset.coa_accum_code);
      setCoaExpense(asset.coa_expense_code);
      setNotes(asset.notes || "");
    } else {
      setCode("");
      setName("");
      setCategory("");
      setAcquiredDate(todayStr());
      setCost("");
      setSalvage("");
      setLifeMonths("");
      setCoaAsset("");
      setCoaAccum("");
      setCoaExpense("");
      setNotes("");
      nextAssetCodeAction().then((res) => {
        if (res.ok) setCode(res.data);
      });
    }
  }, [open, asset]);

  const preview = useMemo(() => {
    const a = { cost: Number(cost) || 0, salvage: Number(salvage) || 0, useful_life_months: Number(lifeMonths) || 0 };
    return { base: depreciableBase(a), monthly: monthlyDepreciation(a) };
  }, [cost, salvage, lifeMonths]);

  async function save() {
    if (!name.trim() || !cost || !lifeMonths || !acquiredDate || !coaAsset || !coaAccum || !coaExpense) return;
    setBusy(true);
    if (isEdit && asset) {
      const patch: UpdateAssetInput = {
        code: code.trim(),
        name: name.trim(),
        category: category.trim() || null,
        acquired_date: acquiredDate,
        cost: Number(cost),
        salvage: Number(salvage) || 0,
        useful_life_months: Number(lifeMonths),
        coa_asset_code: coaAsset,
        coa_accum_code: coaAccum,
        coa_expense_code: coaExpense,
        notes: notes.trim() || null,
      };
      const res = await updateAssetAction(asset.id, patch);
      setBusy(false);
      if (res.ok) {
        toast.success(tr.saved);
        onSaved();
      } else toast.error(`${res.code} · ${res.message}`);
    } else {
      const fields: CreateAssetInput = {
        code: code.trim() || undefined,
        name: name.trim(),
        category: category.trim() || null,
        acquired_date: acquiredDate,
        cost: Number(cost),
        salvage: Number(salvage) || 0,
        useful_life_months: Number(lifeMonths),
        coa_asset_code: coaAsset,
        coa_accum_code: coaAccum,
        coa_expense_code: coaExpense,
        notes: notes.trim() || null,
      };
      const res = await createAssetAction(fields);
      setBusy(false);
      if (res.ok) {
        toast.success(tr.saved);
        onSaved();
      } else toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? tr.editAsset : tr.newAsset}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.cancel}
          </Button>
          <Button size="sm" onClick={save} loading={busy}>
            {isEdit ? tr.save2 : tr.create}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>{tr.codeLabel}</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.name}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.category}</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="asset-category-presets" className={field} />
          <datalist id="asset-category-presets">
            {CATEGORY_PRESETS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label}>{tr.acquired}</label>
          <input type="date" value={acquiredDate} onChange={(e) => setAcquiredDate(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.cost}</label>
          <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.salvage}</label>
          <input type="number" step="0.01" value={salvage} onChange={(e) => setSalvage(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.life}</label>
          <input type="number" step="1" value={lifeMonths} onChange={(e) => setLifeMonths(e.target.value)} className={field} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>{tr.coaAsset}</label>
          <select value={coaAsset} onChange={(e) => setCoaAsset(e.target.value)} className={field}>
            <option value="">{tr.pickAccount}</option>
            {assetCoa.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name_th}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{tr.coaAccum}</label>
          <select value={coaAccum} onChange={(e) => setCoaAccum(e.target.value)} className={field}>
            <option value="">{tr.pickAccount}</option>
            {assetCoa.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name_th}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--app-fg-muted)]">{tr.coaAccumHint}</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{tr.coaExpense}</label>
          <select value={coaExpense} onChange={(e) => setCoaExpense(e.target.value)} className={field}>
            <option value="">{tr.pickAccount}</option>
            {expenseCoa.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name_th}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={label}>{tr.notes}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
        <p className="mb-1.5 text-xs font-semibold text-[var(--app-fg-muted)]">{tr.preview}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            {tr.depBase}: <span className="font-medium">{money(preview.base)}</span>
          </span>
          <span>
            {tr.monthlyCharge}: <span className="font-medium">{money(preview.monthly)}</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}

// ── Schedule drawer ──────────────────────────────────────────────────────────

function ScheduleDrawer({
  assetId,
  canApprove,
  tr,
  money,
  onClose,
  onEdit,
  onDisposed,
}: {
  assetId: string | null;
  canApprove: boolean;
  tr: Tr;
  money: (n: number) => string;
  onClose: () => void;
  onEdit: (a: FixedAsset) => void;
  onDisposed: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<{ asset: FixedAsset; lines: AssetDepreciationLine[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setData(null);
      return;
    }
    let cancelled = false;
    loadAssetDetail(assetId).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else toast.error(`${res.code} · ${res.message}`);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  const schedule = useMemo(() => (data ? scheduleFor(data.asset) : []), [data]);
  const postedByPeriod = useMemo(() => {
    const m = new Map<string, AssetDepreciationLine>();
    for (const l of data?.lines ?? []) m.set(l.period, l);
    return m;
  }, [data]);

  async function dispose() {
    if (!data) return;
    if (!window.confirm(tr.disposeConfirm)) return;
    setBusy(true);
    const res = await disposeAssetAction(data.asset.id, todayStr());
    setBusy(false);
    if (res.ok) onDisposed();
    else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal open={!!assetId} onClose={onClose} title={tr.schedule} className="max-w-2xl">
      {data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold">
                {data.asset.code} · {data.asset.name}
              </p>
              <p className="text-xs text-[var(--app-fg-muted)]">{data.asset.category || "—"}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => onEdit(data.asset)}>
                {tr.save2}
              </Button>
              {canApprove && data.asset.status !== "disposed" && (
                <Button size="sm" variant="danger" onClick={dispose} loading={busy}>
                  <Ban size={14} /> {tr.dispose}
                </Button>
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--app-fg-muted)]">{tr.cost}</p>
              <p className="font-medium">{money(data.asset.cost)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--app-fg-muted)]">{tr.salvage}</p>
              <p className="font-medium">{money(data.asset.salvage)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--app-fg-muted)]">{tr.life}</p>
              <p className="font-medium">{data.asset.useful_life_months}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--app-fg-muted)]">{tr.bookValue}</p>
              <p className="font-medium">{money(bookValue(data.asset))}</p>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-[var(--app-border)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--app-surface)]">
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="px-3 py-2 font-medium">{tr.period}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr.amount}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr.accumulated}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr.bookValue}</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => {
                  const posted = postedByPeriod.get(row.period);
                  return (
                    <tr key={row.period} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-1.5">{row.period}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(row.amount)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(row.accumulated)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(row.bookValue)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {posted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-success)] px-2 py-0.5 text-xs font-medium text-white">
                            {tr.posted}
                            {posted.journal_entry_id && (
                              <a
                                href="/app/accounting"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center text-white/90 hover:text-white"
                                title={tr.viewJournal}
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Run depreciation modal ──────────────────────────────────────────────────

function RunDepreciationModal({
  open,
  onClose,
  tr,
  money,
  onRan,
}: {
  open: boolean;
  onClose: () => void;
  tr: Tr;
  money: (n: number) => string;
  onRan: () => void;
}) {
  const toast = useToast();
  const [period, setPeriod] = useState(thisMonthStr());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunDepreciationResult | null>(null);

  useEffect(() => {
    if (open) {
      setPeriod(thisMonthStr());
      setResult(null);
    }
  }, [open]);

  async function run() {
    setBusy(true);
    const res = await runDepreciationAction(period);
    setBusy(false);
    if (res.ok) {
      setResult(res.data);
      onRan();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr.runDepTitle}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.close}
          </Button>
          <Button size="sm" onClick={run} loading={busy}>
            <PlayCircle size={14} /> {tr.run}
          </Button>
        </>
      }
    >
      <div>
        <label className={label}>{tr.period2}</label>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={field} />
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm">
          {result.status === "already-approved" ? (
            <p className="text-[var(--app-fg-muted)]">{tr.alreadyApproved}</p>
          ) : (
            <div className="grid gap-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--app-fg-muted)]">{tr.resultAssets}</span>
                <span className="font-medium">{result.assets_processed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--app-fg-muted)]">{tr.resultLines}</span>
                <span className="font-medium">{result.lines_created}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--app-fg-muted)]">{tr.resultTotal}</span>
                <span className="font-medium">{money(result.total_amount)}</span>
              </div>
              {result.entry_id && (
                <a href="/app/accounting" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--app-accent)]">
                  <ExternalLink size={12} /> {tr.viewJournal}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
