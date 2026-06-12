"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PosProduct, PosCategory } from "@/lib/db/pos";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import {
  addCategory,
  editCategory,
  removeCategory,
  addProduct,
  editProduct,
  removeProduct,
} from "@/app/app/pos/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    catTitle: "หมวดหมู่",
    catSub: "จัดกลุ่มสินค้าในมินิบาร์",
    addCat: "เพิ่มหมวดหมู่",
    catName: "ชื่อหมวดหมู่",
    delCatConfirm: "ลบหมวดหมู่นี้?",
    noCats: "ยังไม่มีหมวดหมู่",
    prodTitle: "สินค้า",
    prodSub: "สินค้าในมินิบาร์ ราคาและสต๊อก",
    newProd: "เพิ่มสินค้า",
    editProd: "แก้ไขสินค้า",
    name: "ชื่อ",
    category: "หมวดหมู่",
    noCategory: "ไม่มีหมวดหมู่",
    price: "ราคา",
    cost: "ต้นทุน",
    sku: "รหัสสินค้า (SKU)",
    stock: "สต๊อก",
    active: "ใช้งาน",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    cancel: "ยกเลิก",
    del: "ลบ",
    deleted: "ลบแล้ว",
    delProdConfirm: "ลบสินค้านี้?",
    needName: "กรุณาใส่ชื่อ",
    empty: "ยังไม่มีสินค้า",
    emptyHint: "เพิ่มสินค้าชิ้นแรกของคุณ",
  },
  en: {
    catTitle: "Categories",
    catSub: "Group your mini-bar items.",
    addCat: "Add category",
    catName: "Category name",
    delCatConfirm: "Delete this category?",
    noCats: "No categories yet",
    prodTitle: "Products",
    prodSub: "Mini-bar items, prices and stock.",
    newProd: "New product",
    editProd: "Edit product",
    name: "Name",
    category: "Category",
    noCategory: "No category",
    price: "Price",
    cost: "Cost",
    sku: "SKU",
    stock: "Stock",
    active: "Active",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    del: "Delete",
    deleted: "Deleted",
    delProdConfirm: "Delete this product?",
    needName: "Enter a name",
    empty: "No products yet",
    emptyHint: "Add your first product.",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

interface ProductDraft {
  id?: string;
  category_id: string;
  name: string;
  price: number | "";
  cost: number | "";
  sku: string;
  stock: number | "";
  active: boolean;
}

const EMPTY_PRODUCT: ProductDraft = {
  category_id: "",
  name: "",
  price: "",
  cost: "",
  sku: "",
  stock: "",
  active: true,
};

export default function ProductsClient({
  products,
  categories,
  currency,
}: {
  products: PosProduct[];
  categories: PosCategory[];
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const money = (n: number) => `${currency} ${Number(n).toLocaleString()}`;
  const catName = (id: string | null) =>
    id == null ? "—" : categories.find((c) => c.id === id)?.name ?? "—";

  // ── category state ──
  const [newCat, setNewCat] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  async function createCat() {
    const name = newCat.trim();
    if (!name) return;
    setCatBusy(true);
    const res = await addCategory(name);
    setCatBusy(false);
    if (res.ok) {
      toast.success(s("saved"));
      setNewCat("");
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function saveCat(id: string) {
    const name = editingCatName.trim();
    if (!name) return;
    const res = await editCategory(id, name);
    if (res.ok) {
      toast.success(s("saved"));
      setEditingCatId(null);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function delCat(c: PosCategory) {
    if (!window.confirm(s("delCatConfirm"))) return;
    const res = await removeCategory(c.id);
    if (res.ok) {
      toast.success(s("deleted"));
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  // ── product state ──
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  const [saving, setSaving] = useState(false);

  async function toggleActive(p: PosProduct) {
    const res = await editProduct(p.id, { active: !p.active });
    if (res.ok) router.refresh();
    else toast.error(`${res.code} · ${res.message}`);
  }

  async function saveProduct() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error(s("needName"));
      return;
    }
    const input = {
      category_id: editing.category_id === "" ? null : editing.category_id,
      name: editing.name.trim(),
      price: editing.price === "" ? 0 : Number(editing.price),
      cost: editing.cost === "" ? 0 : Number(editing.cost),
      sku: editing.sku.trim() === "" ? null : editing.sku.trim(),
      stock: editing.stock === "" ? 0 : Math.trunc(Number(editing.stock)),
      active: editing.active,
    };
    setSaving(true);
    const res = editing.id
      ? await editProduct(editing.id, input)
      : await addProduct(input);
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      setEditing(null);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function delProduct() {
    if (!editing?.id) return;
    if (!window.confirm(s("delProdConfirm"))) return;
    setSaving(true);
    const res = await removeProduct(editing.id);
    setSaving(false);
    if (res.ok) {
      toast.success(s("deleted"));
      setEditing(null);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  function openEdit(p: PosProduct) {
    setEditing({
      id: p.id,
      category_id: p.category_id ?? "",
      name: p.name,
      price: p.price,
      cost: p.cost,
      sku: p.sku ?? "",
      stock: p.stock,
      active: p.active,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Categories card ── */}
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight">{s("catTitle")}</h2>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("catSub")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categories.length === 0 && (
            <span className="text-sm text-[var(--app-fg-muted)]">{s("noCats")}</span>
          )}
          {categories.map((c) =>
            editingCatId === c.id ? (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--app-accent)] bg-[var(--app-surface)] py-1 pl-2 pr-1"
              >
                <input
                  className="w-28 bg-transparent text-sm outline-none"
                  value={editingCatName}
                  onChange={(e) => setEditingCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCat(c.id);
                    if (e.key === "Escape") setEditingCatId(null);
                  }}
                  autoFocus
                />
                <button
                  onClick={() => saveCat(c.id)}
                  aria-label={s("save")}
                  className="grid h-6 w-6 place-items-center rounded-full text-[var(--app-accent)] hover:bg-[var(--app-surface-2)]"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingCatId(null)}
                  aria-label={s("cancel")}
                  className="grid h-6 w-6 place-items-center rounded-full text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
                >
                  <X size={14} />
                </button>
              </span>
            ) : (
              <span
                key={c.id}
                className="group inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] py-1 pl-3 pr-1.5 text-sm"
              >
                <button
                  onClick={() => {
                    setEditingCatId(c.id);
                    setEditingCatName(c.name);
                  }}
                  className="inline-flex items-center gap-1 font-medium hover:text-[var(--app-accent)]"
                >
                  {c.name}
                  <Pencil size={11} className="opacity-50" />
                </button>
                <button
                  onClick={() => delCat(c)}
                  aria-label={s("del")}
                  className="grid h-5 w-5 place-items-center rounded-full text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                >
                  <X size={13} />
                </button>
              </span>
            ),
          )}

          {/* add category inline */}
          <span className="inline-flex items-center gap-1">
            <input
              className="w-32 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-sm outline-none focus:border-[var(--app-accent)]"
              placeholder={s("catName")}
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createCat();
              }}
            />
            <Button size="sm" onClick={createCat} loading={catBusy} disabled={!newCat.trim()}>
              <Plus size={14} /> {s("addCat")}
            </Button>
          </span>
        </div>
      </div>

      {/* ── Products card ── */}
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{s("prodTitle")}</h2>
            <p className="text-sm text-[var(--app-fg-muted)]">{s("prodSub")}</p>
          </div>
          <Button onClick={() => setEditing({ ...EMPTY_PRODUCT })}>
            <Plus size={16} /> {s("newProd")}
          </Button>
        </div>

        {products.length === 0 ? (
          <EmptyState icon={<Package size={22} />} title={s("empty")} hint={s("emptyHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-left text-xs font-medium text-[var(--app-fg-muted)]">
                  <th className="py-2 pr-3 font-medium">{s("name")}</th>
                  <th className="py-2 pr-3 font-medium">{s("category")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{s("price")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{s("cost")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{s("stock")}</th>
                  <th className="py-2 pr-3 text-center font-medium">{s("active")}</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-[var(--app-border)] last:border-0 hover:bg-[var(--app-surface-2)]"
                    onClick={() => openEdit(p)}
                  >
                    <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                    <td className="py-2.5 pr-3 text-[var(--app-fg-muted)]">{catName(p.category_id)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{money(p.price)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--app-fg-muted)]">
                      {money(p.cost)}
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right tabular-nums ${
                        p.stock <= 0 ? "font-semibold text-[var(--app-danger)]" : ""
                      }`}
                    >
                      {p.stock}
                    </td>
                    <td className="py-2.5 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={() => toggleActive(p)}
                        aria-label={s("active")}
                        className="h-4 w-4 cursor-pointer accent-[var(--app-accent)]"
                      />
                    </td>
                    <td className="py-2.5 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(p)}
                        aria-label={s("editProd")}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Product modal (create / edit) ── */}
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? s("editProd") : s("newProd")}
          footer={
            <>
              {editing.id && (
                <Button variant="danger" onClick={delProduct} loading={saving} className="mr-auto">
                  <Trash2 size={15} /> {s("del")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {s("cancel")}
              </Button>
              <Button onClick={saveProduct} loading={saving}>
                {s("save")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={label}>{s("name")}</label>
              <input
                className={field}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <label className={label}>{s("category")}</label>
              <select
                className={field}
                value={editing.category_id}
                onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
              >
                <option value="">{s("noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>
                  {s("price")} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={editing.price}
                  onChange={(e) =>
                    setEditing({ ...editing, price: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>
                  {s("cost")} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={editing.cost}
                  onChange={(e) =>
                    setEditing({ ...editing, cost: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{s("sku")}</label>
                <input
                  className={field}
                  value={editing.sku}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>{s("stock")}</label>
                <input
                  type="number"
                  step={1}
                  className={field}
                  value={editing.stock}
                  onChange={(e) =>
                    setEditing({ ...editing, stock: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-[var(--app-accent)]"
              />
              {s("active")}
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
