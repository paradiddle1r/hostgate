import { Skeleton, SkeletonRows } from "@/components/app/ui/Skeleton";

// Static skeleton for the dashboard/overview page — mirrors DashboardClient's
// header + hero KPI cards + quick-links + arrivals/departures panels so
// navigation shows instant feedback instead of a frozen screen.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1700px]">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton width={180} height={24} />
          <div className="mt-2">
            <Skeleton width={140} height={14} />
          </div>
        </div>
        <Skeleton width={140} height={38} className="rounded-xl" />
      </div>

      {/* Hero: occupancy + revenue */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 lg:col-span-1">
          <Skeleton width={110} height={12} />
          <div className="mt-3">
            <Skeleton width={80} height={32} />
          </div>
          <div className="mt-3">
            <Skeleton height={10} className="rounded-full" />
          </div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 lg:col-span-2">
          <Skeleton width={130} height={12} />
          <div className="mt-4">
            <SkeletonRows rows={2} columns={[1, 1, 1]} />
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="app-surface rounded-2xl border border-[var(--app-border)] p-5"
          >
            <Skeleton width={32} height={32} className="rounded-xl" />
            <div className="mt-3">
              <Skeleton width="70%" height={14} />
            </div>
          </div>
        ))}
      </div>

      {/* Arrivals / departures / upcoming */}
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="app-surface rounded-2xl border border-[var(--app-border)] p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Skeleton width={90} height={14} />
              <Skeleton width={24} height={18} className="ml-auto rounded-full" />
            </div>
            <SkeletonRows rows={4} columns={[2, 1]} />
          </div>
        ))}
      </div>
    </div>
  );
}
