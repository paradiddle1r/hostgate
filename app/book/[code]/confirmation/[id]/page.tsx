import Link from "next/link";

export const dynamic = "force-dynamic";

export default function BookConfirmationPage({
  params,
  searchParams,
}: {
  params: { code: string; id: string };
  searchParams: { ref?: string };
}) {
  const ref = searchParams.ref ?? "";

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--app-success)] text-white">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ได้รับการจองแล้ว / Booking received</h1>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          ขอบคุณครับ ทางที่พักจะติดต่อกลับเพื่อยืนยันการจอง
          <br />
          Thank you — the property will contact you to confirm.
        </p>
      </div>
      {ref && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            หมายเลขอ้างอิง / Reference
          </div>
          <div className="mt-1 font-mono text-lg font-semibold">{ref}</div>
        </div>
      )}
      <Link
        href={`/book/${params.code}`}
        className="inline-block rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm hover:bg-[var(--app-surface-2)]"
      >
        จองอีกครั้ง / Make another booking
      </Link>
    </div>
  );
}
