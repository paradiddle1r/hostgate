import { Skeleton, SkeletonRows } from "@/components/app/ui/Skeleton";

// Static skeleton for the guests page — mirrors GuestsClient's header +
// filter chips + table so navigating here shows instant feedback instead of
// a frozen screen while guests/bookings load.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton width={110} height={24} />
        <Skeleton width={200} height={36} className="rounded-lg" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={80} height={28} className="rounded-full" />
        ))}
      </div>

      <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)] p-4">
        <SkeletonRows rows={10} columns={[2, 1, 1, 1, 1]} />
      </div>
    </div>
  );
}
