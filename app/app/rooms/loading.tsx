import { Skeleton, SkeletonRows } from "@/components/app/ui/Skeleton";

// Static skeleton for the rooms page — mirrors RoomsClient's header + one
// floor-grouped table per floor so navigating here shows instant feedback
// instead of a frozen screen while rooms/room-types load.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Skeleton width={100} height={24} />
        <Skeleton width={60} height={14} />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, f) => (
          <div
            key={f}
            className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]"
          >
            <div className="border-b border-[var(--app-border)] px-4 py-2">
              <Skeleton width={70} height={14} />
            </div>
            <div className="p-4">
              <SkeletonRows rows={4} columns={[1, 1, 2, 1, 1]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
