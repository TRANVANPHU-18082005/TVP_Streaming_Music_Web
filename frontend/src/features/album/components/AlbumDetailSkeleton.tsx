import { Skeleton } from "@/components/ui/skeleton";

export const AlbumDetailSkeleton = () => {
  return (
    <div className="w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row items-end gap-6 p-6 pb-8 bg-gradient-to-b from-muted/50 to-background">
        <Skeleton className="w-52 h-52 rounded-md shadow-xl" /> {/* Cover */}
        <div className="flex flex-col gap-3 w-full max-w-xl">
          <Skeleton className="h-4 w-20" /> {/* Type */}
          <Skeleton className="h-12 w-3/4" /> {/* Title */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" /> {/* Avatar */}
            <Skeleton className="h-4 w-40" /> {/* Artist info */}
          </div>
        </div>
      </div>
      {/* List Skeleton */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-12 w-12 rounded-full" /> {/* Play Button */}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
};
export default AlbumDetailSkeleton;
