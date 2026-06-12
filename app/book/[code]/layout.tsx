import type { ReactNode } from "react";
import { getPublicProperty } from "@/lib/book";

export const dynamic = "force-dynamic";

export default async function BookLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { code: string };
}) {
  const property = await getPublicProperty(params.code);

  return (
    <div
      data-theme="light"
      className="app-shell min-h-screen"
      style={{ background: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{property?.name ?? "Booking"}</div>
            <div className="text-xs text-[var(--app-fg-muted)]">
              {property?.city ? `${property.city} · ` : ""}จองห้องพัก / Book your stay
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 pt-4 text-center text-xs text-[var(--app-fg-muted)]">
        Powered by HostGate
      </footer>
    </div>
  );
}
