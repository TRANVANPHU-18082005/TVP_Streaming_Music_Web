import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FeedItem } from "../components/FeedItem";
import { ForMeHeader } from "../components/ForMeHeader";
import { useForMeFeed } from "../hooks/useForMeFeed";
import { setQueue, jumpToIndex, selectPlayer } from "@/features/player/slice/playerSlice";
import { Loader2, Sparkles } from "lucide-react";
import { CLIENT_PATHS } from "@/config/paths";

export const ForMePage = () => {
  const { data, isLoading, isError } = useForMeFeed(50);
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);

  // Khởi tạo Queue khi có data
  useEffect(() => {
    if (data?.data?.tracks && data.data.tracks.length > 0) {
      const newTracks = data.data.tracks;
      const currentQueueMatches = player.currentSource?.id === `${CLIENT_PATHS.FOR_ME}` && 
                                  player.activeQueueIds.length > 0 &&
                                  player.activeQueueIds[0] === newTracks[0]._id;

      if (!currentQueueMatches) {
        dispatch(setQueue({
          trackIds: newTracks.map(t => t._id),
          initialMetadata: newTracks,
          startIndex: 0,
          source: { id: CLIENT_PATHS.FOR_ME, type: 'suggestions', title: 'Dành cho bạn' },
        }));
      } else {
        setActiveIndex(player.currentIndex);
        setTimeout(() => {
          if (containerRef.current) {
            const container = containerRef.current;
            const targetScroll = player.currentIndex * container.clientHeight;
            container.scrollTo({ top: targetScroll, behavior: 'instant' as ScrollBehavior });
          }
        }, 100);
      }
    }
  }, [data, dispatch]);

  // Xử lý cuộn để đồng bộ index
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const height = container.clientHeight;
      const scrollTop = container.scrollTop;
      const index = Math.round(scrollTop / height);

      if (index !== activeIndex && index >= 0 && index < (data?.data?.tracks.length || 0)) {
        setActiveIndex(index);
        if (player.currentSource?.id === `${CLIENT_PATHS.FOR_ME}`) {
          dispatch(jumpToIndex(index));
        }
      }
    };

    let scrollTimeout: any;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 50);
    };

    container.addEventListener("scroll", throttledScroll, { passive: true });
    return () => container.removeEventListener("scroll", throttledScroll);
  }, [activeIndex, data, dispatch, player.currentSource?.id]);

  // Sync cuộn khi next bài từ Global Player hoặc nút Up/Down trong FeedItem
  useEffect(() => {
    if (player.currentSource?.id === `${CLIENT_PATHS.FOR_ME}` && player.currentIndex !== activeIndex && containerRef.current) {
      const container = containerRef.current;
      const targetScroll = player.currentIndex * container.clientHeight;
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      setActiveIndex(player.currentIndex);
    }
  }, [player.currentIndex, player.currentSource?.id]);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-black gap-4">
        {/* ForMeHeader hiển thị trong loading state */}
        <ForMeHeader />
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-white/80 text-sm">Đang tải đề xuất của bạn...</p>
      </div>
    );
  }

  if (isError || !data?.data?.tracks?.length) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-black gap-4">
        <ForMeHeader />
        <Sparkles className="w-10 h-10 text-white/30" />
        <p className="text-white/70 text-base">Không tìm thấy bài hát nào.</p>
      </div>
    );
  }

  return (
    // Wrapper phải relative để ForMeHeader (fixed) đặt đúng context
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* ForMe-specific header — ẩn/hiện tự động */}
      <ForMeHeader />

      {/* Snap-scroll feed container */}
      <div
        ref={containerRef}
        className="w-full h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {data.data.tracks.map((track, index) => (
          <FeedItem
            key={`${track._id}-${index}`}
            track={track}
            index={index}
            isActive={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
};
