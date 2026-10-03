import { memo } from "react";
import { Layers, ChevronRight, Plus, Disc3 } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

import { MashupCard } from "./MashupCard";
import { useMashupFeed } from "../hooks/useMashups";
import { IMashup } from "../types";
import { useAppSelector } from "@/store/hooks";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import SectionAmbient from "@/components/SectionAmbient";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.965 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.44, ease: EASE_EXPO },
  },
};

const mobileCardVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.065, duration: 0.38, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
const MashupsHeader = memo(({ viewAllHref, user }: { viewAllHref: string, user: any }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center size-6 rounded-md"
            style={{
              background: "hsl(var(--wave-4) / 0.12)",
              color: "hsl(var(--wave-4))",
            }}
          >
            <Layers className="size-3.5" />
          </div>
          <span className="text-overline" style={{ color: "hsl(var(--wave-4))" }}>
            Bản Mix
          </span>
        </div>

        <h2 className="text-section-title text-foreground leading-tight flex items-center gap-2" id="mashup-heading">
          Mashup Hot
          <motion.span
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          />
        </h2>

        <p className="text-section-subtitle hidden sm:block">
          Những bản DJ remix được yêu thích nhất.
        </p>
      </div>

      <div className="flex items-center gap-4 mt-1">
        {user && (
          <button
            onClick={() => navigate("/mashups/create")}
            className="group hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary transition-all hover:border-primary/30 hover:bg-primary/10 sm:flex"
          >
            <Plus className="size-3.5" /> Tạo Mashup
          </button>
        )}
        <Link
          to={viewAllHref}
          className={cn(
            "group flex items-center gap-1.5 shrink-0",
            "text-sm font-medium text-wave-4 opacity-70",
            "hover:text-wave-4 transition-colors duration-200 hover:opacity-100",
          )}
          style={{ "--tw-text-opacity": 1 } as React.CSSProperties}
        >
          <span>Xem tất cả</span>
          <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
});
MashupsHeader.displayName = "MashupsHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <>
    <div className="flex gap-4 overflow-hidden lg:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[168px] sm:w-[200px] shrink-0 space-y-2.5">
          <div className="skeleton skeleton-cover" style={{ borderRadius: "1rem" }} />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
    <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2.5">
          <div className="skeleton skeleton-cover" style={{ borderRadius: "1rem" }} />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
  </>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// CTA CARD
// ─────────────────────────────────────────────────────────────────────────────
const CreateMashupCard = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(user ? "/mashups/create" : "/login")}
      className="group flex flex-col gap-3 relative album-card !overflow-visible p-2 rounded-2xl transition-all duration-300 w-full h-full min-h-[220px]"
    >
      <div className="relative aspect-square overflow-hidden rounded-[18px] transition-all duration-500 bg-primary/5 border-2 border-dashed border-primary/30 group-hover:border-primary/60 group-hover:bg-primary/10 flex flex-col items-center justify-center gap-3">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary shadow-inner ring-1 ring-primary/20 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
          <Disc3 className="size-6" />
        </div>
        <p className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
          Tạo Mashup
        </p>
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GRID & SCROLL
// ─────────────────────────────────────────────────────────────────────────────
const MashupGrid = memo(({ mashups, user }: { mashups: IMashup[], user: any }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-48px" }}
    className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
  >
    {mashups.map((mashup) => (
      <motion.div key={mashup._id} variants={cardVariants}>
        <MashupCard mashup={mashup} variant="default" />
      </motion.div>
    ))}
    <motion.div variants={cardVariants}>
      <CreateMashupCard user={user} />
    </motion.div>
  </motion.div>
));
MashupGrid.displayName = "MashupGrid";

const MashupScroll = memo(({ mashups, user }: { mashups: IMashup[], user: any }) => (
  <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
    <HorizontalScroll>
      {mashups.map((mashup, i) => (
        <motion.div
          key={mashup._id}
          custom={i}
          variants={mobileCardVariants}
          initial="hidden"
          animate="visible"
          className={cn("snap-start shrink-0", "w-[168px] sm:w-[200px]", "first:pl-0")}
        >
          <MashupCard mashup={mashup} variant="default" />
        </motion.div>
      ))}
      <motion.div
        custom={mashups.length}
        variants={mobileCardVariants}
        initial="hidden"
        animate="visible"
        className={cn("snap-start shrink-0", "w-[168px] sm:w-[200px]", "last:pr-4")}
      >
        <CreateMashupCard user={user} />
      </motion.div>
    </HorizontalScroll>
  </div>
));
MashupScroll.displayName = "MashupScroll";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SECTION
// ─────────────────────────────────────────────────────────────────────────────
export const MashupHomeSection = () => {
  const { user } = useAppSelector((state) => state.auth);
  // Lấy 5 bài để chừa 1 slot cho nút Tạo Mashup trên desktop (6 columns)
  const { data, isLoading } = useMashupFeed(5);
  const mashups: IMashup[] = data?.pages?.flatMap((p) => p.data?.feed ?? []) ?? [];

  if (isLoading) {
    return (
      <section className="section-block section-block--alt">
        <div className="section-container">
          <MashupsHeader viewAllHref="/mashups/feed" user={user} />
          <SkeletonGrid count={6} />
        </div>
      </section>
    );
  }

  if (!mashups.length && !isLoading) return null;

  return (
    <>
      <div
        className="lg:block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-4) / 0.3) 30%,
              hsl(var(--wave-4) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-4) / 0.1)",
        }}
      />
      <section className="section-block section-block--alt" aria-labelledby="mashup-heading">
        <SectionAmbient style="wave-4" />
        <div className="section-container">
          <MashupsHeader viewAllHref="/mashups/feed" user={user} />
          
          <div className="relative">
            <MashupScroll mashups={mashups} user={user} />
            <MashupGrid mashups={mashups} user={user} />
          </div>
        </div>
      </section>
    </>
  );
};
