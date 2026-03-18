import { Disc3 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import { Album } from "@/features/album/types";
import { SectionHeader } from "@/pages/client/home/SectionHeader";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";

import { useFeatureAlbums } from "@/features/album/hooks/useAlbumsQuery";
import albumApi from "@/features/album/api/albumApi";
import { albumKeys } from "@/features/album/utils/albumKeys";
import { useAppDispatch } from "@/store/hooks";
import { setIsPlaying, setQueue } from "@/features";

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export function FeaturedAlbums() {
  const { data: albums, isLoading, isError } = useFeatureAlbums(6);
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const handlePlayAlbum = async (albumId: string) => {
    try {
      const res = await queryClient.fetchQuery({
        queryKey: albumKeys.detail(albumId),
        queryFn: () => albumApi.getById(albumId),
        staleTime: 1000 * 60 * 5,
      });

      const tracks = res.data?.tracks;

      if (!tracks || tracks.length === 0) {
        toast.error("Album này chưa có bài hát nào.");
        return;
      }

      dispatch(setQueue({ tracks, startIndex: 0 }));
      dispatch(setIsPlaying(true));
      toast.success(`Đang phát ${tracks.length} bài từ album`);
    } catch {
      toast.error("Không thể tải album. Vui lòng thử lại.");
      throw new Error("Failed to load album");
    }
  };

  return (
    <section className="section-block bg-background">
      <div className="section-container">
        <div className="section-header-wrap">
          <SectionHeader
            icon={<Disc3 className="w-4 h-4" />}
            label="Selection"
            title="Featured Albums"
            description="Album nổi bật được biên tập chọn lọc."
            viewAllHref="/albums"
          />
        </div>

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : isError ? (
          <ErrorState message="Không thể tải albums." />
        ) : !albums?.length ? (
          <EmptyState message="Chưa có album nổi bật." />
        ) : (
          <div className="relative">
            {/* Mobile Horizontal Scroll */}
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {albums.map((album: Album, i: number) => (
                  <motion.div
                    key={album._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.06,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="snap-start shrink-0 w-[200px] sm:w-[220px] first:pl-0 last:pr-4"
                  >
                    <PublicAlbumCard
                      album={album}
                      onPlay={() => handlePlayAlbum(album._id)}
                    />
                  </motion.div>
                ))}
              </HorizontalScroll>
            </div>

            {/* Desktop Grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
            >
              {albums.map((album: Album) => (
                <motion.div key={album._id} variants={cardVariants}>
                  <PublicAlbumCard
                    album={album}
                    onPlay={() => handlePlayAlbum(album._id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SkeletonGrid({ count }: { count: number }) {
  return (
    <>
      {/* Mobile */}
      <div className="flex gap-4 overflow-hidden lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[200px] shrink-0 space-y-2.5">
            <Skeleton className="aspect-square rounded-2xl" />
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <Skeleton className="aspect-square rounded-2xl" />
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
      {message}
    </div>
  );
}
