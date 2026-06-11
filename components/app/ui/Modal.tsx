"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Optional max-width class for the card. Defaults to a comfortable dialog width. */
  className?: string;
};

/**
 * Centered dialog over a dimmed backdrop. Closes on Esc + backdrop click,
 * locks body scroll while open, and renders its card on `.app-surface`
 * (frosted on the glass themes). Full-width on mobile.
 */
export default function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  className = "max-w-lg",
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // Backdrop click only — ignore clicks that bubble up from the card.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={cardRef}
        className={
          "app-surface relative z-10 w-full overflow-hidden rounded-t-2xl border " +
          "border-[var(--app-border)] text-[var(--app-fg)] shadow-2xl " +
          "sm:rounded-2xl " +
          className
        }
      >
        {title != null && (
          <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--app-fg)]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="px-5 py-4">{children}</div>

        {footer != null && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
