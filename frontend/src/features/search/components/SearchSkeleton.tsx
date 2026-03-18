import { Skeleton } from "@/components/ui/skeleton";

export const SearchSkeleton = () => {
  return (
    <div className="space-y-12 sm:space-y-16 mt-4 w-full animate-pulse">
      {/* KẾT QUẢ HÀNG ĐẦU & BÀI HÁT (Grid 5 - 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-16">
        {/* Cột 1: Top Result Skeleton */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4 sm:space-y-5">
          <Skeleton className="h-8 w-48 rounded-md" />
          <div className="h-[200px] sm:h-[240px] w-full bg-card border border-border/40 rounded-[2rem] p-6 md:p-8 flex flex-col sm:flex-row gap-6 md:gap-8 items-start sm:items-center">
            <Skeleton className="size-28 sm:size-36 md:size-40 rounded-full shrink-0" />
            <div className="flex-1 space-y-4 w-full">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Cột 2: Songs List Skeleton */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4 sm:space-y-5">
          <Skeleton className="h-8 w-32 rounded-md" />
          <div className="flex flex-col gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl"
              >
                <Skeleton className="size-12 sm:size-14 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
                <Skeleton className="hidden sm:block h-4 w-12 rounded-md" />
                <Skeleton className="size-8 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CÁC HÀNG GRID BÊN DƯỚI (Artist, Album...) */}
      <div className="space-y-16 sm:space-y-20 pt-8">
        {[1, 2].map((section) => (
          <div key={section} className="space-y-4 sm:space-y-6">
            <Skeleton className="h-8 w-48 rounded-md" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="space-y-4">
                  {/* Trộn ngẫu nhiên layout Tròn (Artist) và Vuông (Album) cho tự nhiên */}
                  <Skeleton
                    className={
                      section === 1
                        ? "w-full aspect-square rounded-full"
                        : "w-full aspect-square rounded-[20px]"
                    }
                  />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4 mx-auto sm:mx-0 rounded-md" />
                    <Skeleton className="h-3 w-1/2 mx-auto sm:mx-0 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default SearchSkeleton;
