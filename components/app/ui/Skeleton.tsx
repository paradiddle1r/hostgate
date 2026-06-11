import type { CSSProperties } from "react";

export type SkeletonProps = {
  /** CSS width — number (px) or any CSS length string. Defaults to "100%". */
  width?: number | string;
  /** CSS height — number (px) or any CSS length string. Defaults to 12px. */
  height?: number | string;
  className?: string;
};

function toLen(v: number | string): string {
  return typeof v === "number" ? `${v}px` : v;
}

/** A single shimmering placeholder bar. Shimmer comes from `.app-skeleton`. */
export function Skeleton({
  width = "100%",
  height = 12,
  className = "",
}: SkeletonProps) {
  const style: CSSProperties = {
    width: toLen(width),
    height: toLen(height),
  };
  return (
    <span
      aria-hidden="true"
      className={`app-skeleton block rounded-md ${className}`}
      style={style}
    />
  );
}

export type SkeletonRowsProps = {
  /** Number of rows to render. Defaults to 3. */
  rows?: number;
  /**
   * Column width ratios per row. Each entry becomes a flex-grow weight, so
   * `[2, 1, 1]` renders a wide first cell and two narrower ones. Defaults to
   * a single full-width column.
   */
  columns?: number[];
  className?: string;
};

/** A stack of skeleton rows, each split into proportional columns. */
export function SkeletonRows({
  rows = 3,
  columns = [1],
  className = "",
}: SkeletonRowsProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col gap-3 ${className}`}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {columns.map((ratio, c) => (
            <div key={c} style={{ flexGrow: ratio, flexBasis: 0 }}>
              <Skeleton height={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
