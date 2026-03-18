import { Skeleton } from "@/components/ui/skeleton";

export const PlaylistDetailSkeleton = () => {
  return (
    <div className="w-full min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row items-end gap-8 p-8 pb-10 bg-gradient-to-b from-muted/30 to-background pt-24">
        <Skeleton className="size-52 md:size-60 rounded-xl shadow-xl" />
        <div className="flex flex-col gap-4 w-full max-w-3xl">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 md:h-16 w-3/4" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      {/* List Skeleton */}
      <div className="px-8 mt-4 space-y-4">
        <div className="flex gap-4 mb-6">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-8" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-4 w-24 hidden md:block" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
};
export default PlaylistDetailSkeleton;
