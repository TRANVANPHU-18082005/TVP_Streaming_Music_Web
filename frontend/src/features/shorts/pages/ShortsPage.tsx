import { useEffect, useRef, useCallback, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { shortsApi } from "../api/shortsApi";
import { ShortFeedItem } from "../components/ShortFeedItem";
import { Loader2, Music2, ChevronUp, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ForMeHeader } from "@/features/for-me/components/ForMeHeader";
import { useDispatch, useSelector } from "react-redux";
import { setIsPlaying, selectPlayer } from "@/features/player/slice/playerSlice";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";

const BATCH_SIZE = 10;

export const ShortsPage = () => {
  const [activeIndex, setActiveIndex] = useState(0);
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
  // Dùng "scrollend" event (Chrome 114+) để biết chắc snap đã settle
  // Fallback: debounce 120ms cho browser cũ hơn
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const commitIndex = () => {
      const height = container.clientHeight;
      if (height === 0) return;
      const index = Math.round(container.scrollTop / height);
      if (index >= 0 && index < allShorts.length) {
        setActiveIndex(index);
      }
    };

    // scrollend: fires exactly once when inertia + snap finishes
    const supportsScrollEnd = "onscrollend" in window;
    let debounceTimer: ReturnType<typeof setTimeout>;

    if (supportsScrollEnd) {
      container.addEventListener("scrollend", commitIndex, { passive: true });
    } else {
      // Fallback debounce 150ms
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
  }, [allShorts.length]); // Chỉ re-attach khi list thay đổi, KHÔNG để activeIndex vào deps


  // ── Prefetch trigger: khi còn 3 item cuối → fetch batch mới ─────────────
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

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <ForMeHeader />
        <PremiumMusicVisualizer active={true} />
        <p className="text-white/60 text-sm">Đang tải Shorts...</p>
      </div>
    );
  }

  // ── Error / Empty State ───────────────────────────────────────────────────
  if (isError || allShorts.length === 0) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <ForMeHeader />
        <Music2 className="w-16 h-16 text-white/20" />
        <p className="text-white/60">Chưa có Short nào được tạo.</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-white/10 rounded-full text-sm hover:bg-white/20 transition-colors mt-4"
        >
          Trở về trang chủ
        </button>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    // Outer: full screen, tối + blur backdrop trên desktop
    <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">

      {/* ForMeHeader nằm tuyệt đối trên cùng — visible cả mobile lẫn desktop */}
      <ForMeHeader />

      {/* ── Desktop ambient backdrop ────────────────────────────────────── */}
      <div
        className="hidden md:block absolute inset-0 z-0 bg-gradient-to-br from-neutral-950 via-black to-neutral-900"
        aria-hidden="true"
      />

      {/* ── Phone Frame Wrapper ─────────────────────────────────────────── */}
      {/*
        Mobile  : w-full h-full (full screen, không border-radius)
        Desktop : w-[390px] h-[min(844px,100vh)] rounded-2xl shadow-2xl
      */}
      <div className="
        relative z-10
        w-full h-screen
        md:w-[390px] md:h-[min(844px,100svh)]
        md:rounded-2xl md:overflow-hidden
        md:shadow-[0_0_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]
      ">

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
            <div className="w-full h-screen bg-black snap-start snap-always flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            </div>
          )}
        </div>

      </div>

      {/* ── Desktop Nav Buttons (↑↓) — chỉ hiện trên md+ ──────────────── */}
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
              <div
                key={realIndex}
                className={`rounded-full transition-all duration-300 ${
                  realIndex === activeIndex
                    ? "w-1.5 h-4 bg-white"
                    : "w-1 h-1 bg-white/30"
                }`}
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

      {/* ── Item counter (desktop only) ────────────────────────────────── */}
      <div className="hidden md:block absolute bottom-6 right-[calc(50%-195px-72px)] z-20 text-white/40 text-xs font-mono">
        {activeIndex + 1}/{allShorts.length}
      </div>

    </div>
  );
};
