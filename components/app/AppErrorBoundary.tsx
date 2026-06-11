"use client";

// Route-level error boundary for the PMS. Catches render-time errors and shows
// the HG error code (if the thrown error carries one) so the user can quote it
// to support, plus a retry. Use as `app/app/error.tsx`.

import { useEffect } from "react";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string; hgCode?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  const code = error.hgCode || "HG-UNKNOWN-500";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-[var(--app-surface-2)] px-3 py-1 font-mono text-xs text-[var(--app-fg-muted)]">
        {code}
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-[var(--app-fg-muted)]">
        Please try again. If it keeps happening, quote the code above to support.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-accent-fg)]"
      >
        Try again
      </button>
    </div>
  );
}
