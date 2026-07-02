import { Skeleton } from "@/components/app/ui/Skeleton";

// Static skeleton for the calendar page — mirrors CalendarClient's toolbar +
// day-grid layout so navigating into /app/calendar shows instant feedback
// instead of a frozen screen while bookings/rates load.
export default function Loading() {
  const days = Array.from({ length: 14 });
  const rooms = Array.from({ length: 8 });

  return (
    <div className="mx-auto w-full max-w-[1700px]">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Skeleton width={110} height={32} className="rounded-lg" />
        <Skeleton width={160} height={32} className="rounded-lg" />
        <Skeleton width={140} height={32} className="ml-auto rounded-lg" />
      </div>

      {/* Stat strip */}
      <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={28} />
          ))}
        </div>
      </div>

      {/* Grid-ish calendar skeleton */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--app-border)]">
          {/* Day header row */}
          <div className="flex border-b border-[var(--app-border)] bg-[var(--app-surface-2)] p-2">
            <div className="w-28 flex-none" />
            {days.map((_, i) => (
              <div key={i} className="flex-1 px-1">
                <Skeleton height={14} />
              </div>
            ))}
          </div>
          {/* Room rows */}
          {rooms.map((_, r) => (
            <div
              key={r}
              className="flex items-center border-b border-[var(--app-border)] p-2 last:border-b-0"
            >
              <div className="w-28 flex-none pr-2">
                <Skeleton width="70%" height={12} />
              </div>
              {days.map((_, i) => (
                <div key={i} className="flex-1 px-1">
                  <Skeleton height={20} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Today panel */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-3">
          <Skeleton width={100} height={14} />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={44} className="rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
