import { Shapes } from "lucide-react";
import { motion } from "framer-motion";

import { Skeleton } from "@/components/ui/skeleton";
import { Genre } from "@/features/genre/types";
import { SectionHeader } from "@/pages/client/home/SectionHeader";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { GenreCard } from "@/features/genre/components/GenreCard";
import { useGenresQuery } from "@/features/genre/hooks/useGenresQuery";

// ─── Animation Variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export function FeaturedGenres() {
  const { data, isLoading, isError } = useGenresQuery({
    page: 1,
    limit: 8,
    isTrending: true,
    sort: "priority",
  });

  const genres = data?.genres as Genre[] | undefined;

  return (
    <section className="section-block bg-muted/20">
      <div className="section-container">
        <div className="section-header-wrap">
          <SectionHeader
            icon={<Shapes className="w-4 h-4" />}
            label="Explore"
            title="Browse by Genre"
            description="Khám phá thế giới âm nhạc qua từng thể loại."
            viewAllHref="/genres"
          />
        </div>

        {isLoading ? (
          <SkeletonGrid />
        ) : isError ? (
          <ErrorState message="Không thể tải thể loại." />
        ) : !genres?.length ? (
          <EmptyState message="Chưa có thể loại nào." />
        ) : (
          <div className="relative">
            {/* Mobile Horizontal Scroll */}
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {genres.map((genre, i) => (
                  <motion.div
                    key={genre._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.06,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="snap-start shrink-0 w-[260px] sm:w-[300px] first:pl-0 last:pr-4"
                  >
                    <GenreCard genre={genre} size="lg" />
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
              className="hidden lg:grid lg:grid-cols-4 gap-5 xl:gap-6"
            >
              {genres.map((genre) => (
                <motion.div key={genre._id} variants={cardVariants}>
                  <GenreCard genre={genre} />
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
function SkeletonGrid() {
  return (
    <>
      {/* Mobile */}
      <div className="flex gap-4 overflow-hidden lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-[260px] aspect-[16/9] rounded-2xl shrink-0"
          />
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-4 gap-5 xl:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/2] rounded-2xl w-full" />
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
