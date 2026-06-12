"use client";

// Tiny client button for the print routes (server components can't call
// window.print()). Hidden in the printed output via the `no-print` class
// (see the @media print rule on each print page).

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
    >
      {label}
    </button>
  );
}
