import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import { Artist } from "@/features/artist/types";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { SectionHeader } from "@/pages/client/home/SectionHeader";
import { useSpotlightArtists } from "@/features/artist/hooks/useArtistsQuery";

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export function ArtistSpotlight() {
  const { data: artists, isLoading, isError } = useSpotlightArtists(5);

  return (
    <section className="section-block bg-background">
      <div className="section-container">
        <div className="section-header-wrap">
          <SectionHeader
            icon={<Users className="w-4 h-4" />}
            label="Spotlight"
            title="Artist Spotlight"
            description="Những nghệ sĩ đang tạo nên xu hướng âm nhạc."
            viewAllHref="/artists"
          />
        </div>

        {isLoading ? (
          <SkeletonGrid count={5} />
        ) : isError ? (
          <ErrorState message="Không thể tải danh sách nghệ sĩ." />
        ) : !artists?.length ? (
          <EmptyState message="Chưa có nghệ sĩ nổi bật." />
        ) : (
          <div className="relative">
            {/* Mobile Horizontal Scroll */}
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {artists.map((artist: Artist, i: number) => (
                  <motion.div
                    key={artist._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.07,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="snap-start shrink-0 w-[200px] sm:w-[220px] first:pl-0 last:pr-4"
                  >
                    <PublicArtistCard artist={artist} variant="compact" />
                  </motion.div>
                ))}
              </HorizontalScroll>
            </div>

            {/* Desktop Grid — 5 columns matching count */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              className="hidden lg:grid grid-cols-3 xl:grid-cols-5 gap-5 xl:gap-6"
            >
              {artists.map((artist: Artist) => (
                <motion.div key={artist._id} variants={cardVariants}>
                  <PublicArtistCard artist={artist} />
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
          <div key={i} className="w-[200px] shrink-0 space-y-3">
            <Skeleton className="aspect-square rounded-full" />
            <Skeleton className="h-3.5 w-2/3 mx-auto rounded-full" />
            <Skeleton className="h-3 w-1/3 mx-auto rounded-full" />
          </div>
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-3 xl:grid-cols-5 gap-5 xl:gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square rounded-full" />
            <Skeleton className="h-3.5 w-2/3 mx-auto rounded-full" />
            <Skeleton className="h-3 w-1/3 mx-auto rounded-full" />
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
