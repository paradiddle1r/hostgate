import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
};

/**
 * Centered icon + title + hint block for empty lists / zero-result states.
 * Uses muted tokens so it sits quietly inside a surface.
 */
export default function EmptyState({
  icon,
  title,
  hint,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon != null && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--app-fg)]">{title}</p>
      {hint != null && (
        <p className="mt-1 max-w-xs text-sm text-[var(--app-fg-muted)]">
          {hint}
        </p>
      )}
      {action != null && <div className="mt-5">{action}</div>}
    </div>
  );
}
