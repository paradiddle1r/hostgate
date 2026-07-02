import { Skeleton, SkeletonRows } from "@/components/app/ui/Skeleton";

// Static skeleton for the bookings page — mirrors BookingsClient's header +
// search bar + table so navigating here shows instant feedback instead of a
// frozen screen while the full booking history loads.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton width={140} height={24} />
        <Skeleton width={200} height={36} className="rounded-lg" />
      </div>

      <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)] p-4">
        <SkeletonRows rows={10} columns={[2, 1, 1, 1, 1, 1]} />
      </div>
    </div>
  );
}
