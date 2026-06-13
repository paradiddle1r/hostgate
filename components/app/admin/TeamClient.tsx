"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TenantMember } from "@/lib/db/operations";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import {
  inviteMember,
  changeRole,
  toggleMemberActive,
  kickMember,
} from "@/app/app/team/actions";

type Role = "owner" | "admin" | "staff";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "ทีมงาน",
    subOne: "สมาชิก",
    subMany: "สมาชิก",
    you: "คุณ",
    owner: "เจ้าของ",
    admin: "ผู้ดูแล",
    staff: "พนักงาน",
    invite: "เพิ่มสมาชิก",
    inviteHint: "ผู้ใช้ต้องสมัครบัญชีก่อน",
    email: "อีเมล",
    role: "บทบาท",
    add: "เพิ่มสมาชิก",
    added: "เพิ่มสมาชิกแล้ว",
    roleChanged: "เปลี่ยนบทบาทแล้ว",
    removed: "นำสมาชิกออกแล้ว",
    removeConfirm: "นำสมาชิกคนนี้ออก?",
    remove: "นำออก",
    needEmail: "กรอกอีเมลก่อน",
    empty: "ยังไม่มีสมาชิก",
    emptyHint: "เชิญเพื่อนร่วมงานเข้ามาในที่พักนี้",
    position: "ตำแหน่ง",
    positionPh: "เช่น แม่บ้าน, แคชเชียร์",
    active: "ใช้งานอยู่",
    disabled: "ปิดใช้งาน",
    enable: "เปิดใช้งาน",
    disable: "ปิดใช้งาน",
    enabled: "เปิดใช้งานแล้ว",
    disabledToast: "ปิดใช้งานแล้ว",
    cantDisableSelf: "ปิดใช้งานบัญชีตัวเองไม่ได้",
    joined: "เข้าร่วมเมื่อ",
  },
  en: {
    title: "Team",
    subOne: "member",
    subMany: "members",
    you: "You",
    owner: "Owner",
    admin: "Admin",
    staff: "Staff",
    invite: "Add member",
    inviteHint: "The person must already have a HostGate account / ผู้ใช้ต้องสมัครบัญชีก่อน",
    email: "Email",
    role: "Role",
    add: "Add member",
    added: "Member added",
    roleChanged: "Role updated",
    removed: "Member removed",
    removeConfirm: "Remove this member?",
    remove: "Remove",
    needEmail: "Enter an email first",
    empty: "No members yet",
    emptyHint: "Invite a teammate to this property.",
    position: "Position",
    positionPh: "e.g. Housekeeper, Cashier",
    active: "Active",
    disabled: "Disabled",
    enable: "Enable",
    disable: "Disable",
    enabled: "Member enabled",
    disabledToast: "Member disabled",
    cantDisableSelf: "You can't disable your own account",
    joined: "Joined",
  },
};

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const ROLES: Role[] = ["owner", "admin", "staff"];

function roleChipClass(role: Role): string {
  switch (role) {
    case "owner":
      return "bg-[var(--app-accent)] text-[var(--app-accent-fg)]";
    case "admin":
      return "bg-[#2563eb] text-white";
    default:
      return "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]";
  }
}

function fallbackName(m: TenantMember): string {
  if (m.display_name && m.display_name.trim()) return m.display_name.trim();
  if (m.email && m.email.includes("@")) return m.email.split("@")[0];
  if (m.email && m.email.trim()) return m.email.trim();
  return "—";
}

export default function TeamClient({
  members,
  currentUserId,
  myRole,
  tenantName,
  plan,
  joinedAt,
}: {
  members: TenantMember[];
  currentUserId: string | null;
  myRole: "owner" | "admin" | "staff";
  tenantName: string;
  plan: string;
  joinedAt?: Record<string, string>;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const canManage = myRole === "owner" || myRole === "admin";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("staff");
  const [invitePosition, setInvitePosition] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roleLabel = (r: Role) => s(r);

  const fmtJoined = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === "en" ? "en-GB" : "th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  async function invite() {
    const value = email.trim();
    if (!value) {
      toast.error(s("needEmail"));
      return;
    }
    setInviting(true);
    const res = await inviteMember(value, inviteRole, invitePosition.trim() || undefined);
    setInviting(false);
    if (res.ok) {
      toast.success(s("added"));
      setEmail("");
      setInviteRole("staff");
      setInvitePosition("");
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function onToggleActive(m: TenantMember) {
    if (m.user_id === currentUserId) {
      toast.error(s("cantDisableSelf"));
      return;
    }
    setBusyId(m.user_id);
    const next = !m.is_active;
    const res = await toggleMemberActive(m.user_id, next);
    setBusyId(null);
    if (res.ok) {
      toast.success(next ? s("enabled") : s("disabledToast"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function onChangeRole(userId: string, role: string) {
    setBusyId(userId);
    const res = await changeRole(userId, role);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("roleChanged"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function onKick(m: TenantMember) {
    if (!window.confirm(s("removeConfirm"))) return;
    setBusyId(m.user_id);
    const res = await kickMember(m.user_id);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("removed"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
        <p className="text-sm text-[var(--app-fg-muted)]">
          {tenantName} · {members.length}{" "}
          {members.length === 1 ? s("subOne") : s("subMany")}
        </p>
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
          <EmptyState icon={<Users size={22} />} title={s("empty")} hint={s("emptyHint")} />
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const isMe = m.user_id === currentUserId;
            const busy = busyId === m.user_id;
            return (
              <div
                key={m.user_id}
                className="app-surface flex items-center gap-3 rounded-2xl border border-[var(--app-border)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{fallbackName(m)}</span>
                    {isMe && (
                      <span className="flex-none rounded-full bg-[var(--app-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-fg-muted)]">
                        {s("you")}
                      </span>
                    )}
                    {/* Active / Disabled status chip — parity with hotel-pms
                        users screen. Backed by tenant_members.is_active. */}
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        m.is_active
                          ? "bg-[rgba(16,185,129,0.15)] text-[#10b981]"
                          : "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
                      }`}
                    >
                      {m.is_active ? s("active") : s("disabled")}
                    </span>
                  </div>
                  {m.email && (
                    <div className="truncate text-sm text-[var(--app-fg-muted)]">{m.email}</div>
                  )}
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--app-fg-muted)]">
                    {m.position && m.position.trim() && <span>{m.position.trim()}</span>}
                    {fmtJoined(joinedAt?.[m.user_id]) && (
                      <span>
                        {s("joined")} {fmtJoined(joinedAt?.[m.user_id])}
                      </span>
                    )}
                  </div>
                </div>

                {canManage ? (
                  <>
                    <select
                      className={field}
                      value={m.role}
                      // Disable on your OWN row to prevent self-demotion (e.g.
                      // an owner accidentally dropping themselves to staff).
                      disabled={busy || isMe}
                      onChange={(e) => onChangeRole(m.user_id, e.target.value)}
                      aria-label={s("role")}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    {!isMe && (
                      <button
                        onClick={() => onToggleActive(m)}
                        disabled={busy}
                        className="flex-none text-xs font-medium text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {m.is_active ? s("disable") : s("enable")}
                      </button>
                    )}
                    {!isMe && (
                      <button
                        onClick={() => onKick(m)}
                        disabled={busy}
                        aria-label={s("remove")}
                        className="text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </>
                ) : (
                  <span
                    className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleChipClass(
                      m.role,
                    )}`}
                  >
                    {roleLabel(m.role)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite */}
      {canManage && (
        <div className="app-surface mt-4 space-y-3 rounded-2xl border border-[var(--app-border)] p-5">
          <div className="flex items-center gap-2 font-semibold">
            <UserPlus size={16} className="text-[var(--app-accent)]" /> {s("invite")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
                {s("email")}
              </label>
              <input
                type="email"
                className={`${field} w-full`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
                {s("role")}
              </label>
              <select
                className={`${field} w-full`}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {s("position")}
            </label>
            <input
              type="text"
              className={`${field} w-full`}
              value={invitePosition}
              onChange={(e) => setInvitePosition(e.target.value)}
              placeholder={s("positionPh")}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={invite} loading={inviting}>
              <UserPlus size={16} /> {s("add")}
            </Button>
          </div>
          <p className="text-xs text-[var(--app-fg-muted)]">{s("inviteHint")}</p>
        </div>
      )}
    </div>
  );
}
