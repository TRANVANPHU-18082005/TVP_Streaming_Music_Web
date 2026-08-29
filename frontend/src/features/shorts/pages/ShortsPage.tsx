import { useEffect, useRef, useCallback, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { shortsApi } from "../api/shortsApi";
import { ShortFeedItem } from "../components/ShortFeedItem";
import { Loader2, Music2, ChevronUp, ChevronDown, TvMinimalPlay } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ForMeHeader } from "@/features/for-me/components/ForMeHeader";
import { useDispatch, useSelector } from "react-redux";
import { setIsPlaying, selectPlayer } from "@/features/player/slice/playerSlice";
import { motion, AnimatePresence } from "framer-motion";

const BATCH_SIZE = 10;

// Shimmer placeholder khi load
const ShortShimmer = () => (
  <div className="w-full h-full bg-neutral-900 snap-start snap-always flex flex-col justify-end p-6 gap-3 animate-pulse">
    <div className="h-4 w-36 rounded-full bg-white/10" />
    <div className="h-6 w-56 rounded-full bg-white/10" />
    <div className="h-3 w-48 rounded-full bg-white/10" />
    <div className="h-1 w-full rounded-full bg-white/10 mt-4" />
  </div>
);

export const ShortsPage = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);

  // ── Pause global player khi vào Shorts ───────────────────────────────────
  useEffect(() => {
    if (player.isPlaying) {
      dispatch(setIsPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ẩn swipe hint sau 3 giây ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowSwipeHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Infinite Query ────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["shorts-feed"],
    queryFn: ({ pageParam }) =>
      shortsApi.getShortsFeed(BATCH_SIZE, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.data?.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Flatten tất cả pages thành 1 mảng duy nhất
  const allShorts = data?.pages.flatMap((p) => p.data?.feed ?? []) ?? [];

  // ── Snap Scroll → activeIndex detection ─────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const commitIndex = () => {
      const height = container.clientHeight;
      if (height === 0) return;
      const index = Math.round(container.scrollTop / height);
      if (index >= 0 && index < allShorts.length) {
        setActiveIndex(index);
        // Ẩn swipe hint khi đã scroll
        if (index > 0) setShowSwipeHint(false);
      }
    };

    const supportsScrollEnd = "onscrollend" in window;
    let debounceTimer: ReturnType<typeof setTimeout>;

    if (supportsScrollEnd) {
      container.addEventListener("scrollend", commitIndex, { passive: true });
    } else {
      const onScroll = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(commitIndex, 150);
      };
      container.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      if (supportsScrollEnd) {
        container.removeEventListener("scrollend", commitIndex);
      } else {
        container.removeEventListener("scroll", commitIndex);
        clearTimeout(debounceTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShorts.length]);

  // ── Prefetch trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      allShorts.length > 0 &&
      activeIndex >= allShorts.length - 3
    ) {
      fetchNextPage();
    }
  }, [activeIndex, allShorts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Programmatic scroll navigation ───────────────────────────────────────
  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= allShorts.length) return;
      const height = container.clientHeight;
      container.scrollTo({ top: index * height, behavior: "smooth" });
    },
    [allShorts.length],
  );

  const handlePrev = useCallback(() => scrollToIndex(activeIndex - 1), [activeIndex, scrollToIndex]);
  const handleNext = useCallback(() => scrollToIndex(activeIndex + 1), [activeIndex, scrollToIndex]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); handlePrev(); }
      if (e.key === "ArrowDown") { e.preventDefault(); handleNext(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePrev, handleNext]);

  // ── Loading State (shimmer) ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black overflow-hidden flex items-center justify-center relative">
        <ForMeHeader />
        <div className="relative z-10 w-full h-screen md:w-[390px] md:h-[min(844px,100svh)] md:rounded-2xl md:overflow-hidden md:shadow-[0_0_80px_rgba(0,0,0,0.8)]">
          <ShortShimmer />
        </div>
        {/* Loading indicator */}
        <div className="absolute bottom-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-20">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          <p className="text-white/30 text-xs">Đang tải Shorts...</p>
        </div>
      </div>
    );
  }

  // ── Error / Empty State ───────────────────────────────────────────────────
  if (isError || allShorts.length === 0) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-6">
        <ForMeHeader />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
            <TvMinimalPlay className="w-10 h-10 text-white/20" />
          </div>
          <div className="text-center">
            <p className="text-white/70 font-semibold">Chưa có Short nào</p>
            <p className="text-white/30 text-sm mt-1">Hãy quay lại sau nhé!</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-full text-sm text-white/80 font-medium transition-all duration-200 border border-white/10"
          >
            Trở về trang chủ
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  const progressPercent = allShorts.length > 1
    ? (activeIndex / (allShorts.length - 1)) * 100
    : 100;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      <ForMeHeader />

      {/* ── Desktop ambient backdrop ─────────────────────────────────────── */}
      <div
        className="hidden md:block absolute inset-0 z-0 bg-gradient-to-br from-neutral-950 via-black to-neutral-900"
        aria-hidden="true"
      />

      {/* ── Phone Frame Wrapper ──────────────────────────────────────────── */}
      <div className="
        relative z-10
        w-full h-screen
        md:w-[390px] md:h-[min(844px,100svh)]
        md:rounded-2xl md:overflow-hidden
        md:shadow-[0_0_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]
      ">
        {/* ── Progress bar at top ─────────────────────────────────────── */}
        <div className="absolute top-0 inset-x-0 z-30 h-[2px] bg-white/10">
          <motion.div
            className="h-full bg-white/50 origin-left"
            animate={{ scaleX: progressPercent / 100 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ transformOrigin: "left center" }}
          />
        </div>

        {/* ── Swipe Up Hint ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {showSwipeHint && allShorts.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-15 inset-x-0 z-30 flex flex-col items-center gap-1 pointer-events-none"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              >
                <ChevronUp className="w-6 h-6 text-white/50" />
              </motion.div>
              <span className="text-white/40 text-[11px] font-medium tracking-wide uppercase">
                Vuốt lên để xem tiếp
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snap Scroll Container */}
        <div
          ref={containerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>

          {allShorts.map((short, index) => (
            <ShortFeedItem
              key={short._id}
              short={short}
              isActive={index === activeIndex}

            />
          ))}

          {/* Loading indicator khi fetch trang tiếp theo */}
          {isFetchingNextPage && (
            <div className="w-full h-screen bg-black snap-start snap-always flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
              <p className="text-white/30 text-xs">Đang tải thêm...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Nav Buttons (↑↓) ─────────────────────────────────────── */}
      <div className="
        hidden md:flex flex-col gap-3
        absolute z-20
        right-[calc(50%-195px-72px)]
        translate-y-8
      ">
        <button
          id="shorts-nav-prev"
          onClick={handlePrev}
          disabled={activeIndex === 0}
          aria-label="Short trước"
          className="
            w-12 h-12 rounded-full
            bg-white/10 hover:bg-white/20 active:bg-white/30
            backdrop-blur-md border border-white/10
            flex items-center justify-center
            text-white transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:scale-110 active:scale-95
          "
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Indicator dots */}
        <div className="flex flex-col items-center gap-1.5 py-1">
          {allShorts.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((_, i) => {
            const realIndex = Math.max(0, activeIndex - 2) + i;
            return (
              <motion.div
                key={realIndex}
                animate={{
                  width: realIndex === activeIndex ? 6 : 4,
                  height: realIndex === activeIndex ? 16 : 4,
                  opacity: realIndex === activeIndex ? 1 : 0.3,
                }}
                transition={{ duration: 0.25 }}
                className={`rounded-full bg-white`}
              />
            );
          })}
        </div>

        <button
          id="shorts-nav-next"
          onClick={handleNext}
          disabled={activeIndex === allShorts.length - 1 && !hasNextPage}
          aria-label="Short tiếp theo"
          className="
            w-12 h-12 rounded-full
            bg-white/10 hover:bg-white/20 active:bg-white/30
            backdrop-blur-md border border-white/10
            flex items-center justify-center
            text-white transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:scale-110 active:scale-95
          "
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* ── Item counter (desktop only) ──────────────────────────────────── */}
      <div className="hidden md:flex absolute bottom-6 right-[calc(50%-195px-72px)] z-20 flex-col items-center gap-0.5">
        <Music2 className="w-4 h-4 text-white/20" />
        <span className="text-white/30 text-[10px] font-mono">
          {activeIndex + 1}/{allShorts.length}
        </span>
      </div>
    </div>
  );
};
