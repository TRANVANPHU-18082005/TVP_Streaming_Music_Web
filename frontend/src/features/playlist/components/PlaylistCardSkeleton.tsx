import React from "react";
import { cn } from "@/lib/utils";

const PlaylistCardSkeleton: React.FC<{ className?: string }> = ({
  className,
}) => (
  <article
    className={cn(
      "group flex flex-col gap-3 relative",
      "album-card !overflow-visible p-2 rounded-2xl",
      className,
    )}
    aria-hidden="true"
  >
    <div className="relative aspect-square overflow-hidden rounded-[18px] bg-muted border border-border/10">
      <div className="skeleton h-full w-full" />
    </div>

    <div className="flex flex-col gap-1 px-1">
      <div className="h-4 w-32 skeleton rounded" />
      <div className="h-3 w-20 skeleton rounded mt-1" />
    </div>
  </article>
);

export default PlaylistCardSkeleton;
