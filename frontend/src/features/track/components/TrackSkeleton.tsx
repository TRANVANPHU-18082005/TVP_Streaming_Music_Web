// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from "react";

export const TrackSkeleton = memo(({ length = 5 }: { length?: number }) => (
  <div className="flex flex-col gap-1" role="status" aria-busy="true">
    {Array.from({ length }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        aria-hidden="true"
      >
        <div className="skeleton w-[52px] shrink-0 h-8 rounded-full" />
        <div className="skeleton w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 min-w-0">
          <div
            className="skeleton h-3.5 rounded-full"
            style={{ width: `${40 + (i % 3) * 12}%` }}
          />
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: `${24 + (i % 4) * 8}%` }}
          />
        </div>
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
      </div>
    ))}
  </div>
));
TrackSkeleton.displayName = "TrackSkeleton";
export default TrackSkeleton;
