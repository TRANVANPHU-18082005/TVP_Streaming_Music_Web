import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  MoreHorizontal,
  TrendingUp,
  Search as SearchIcon,
  Music2,
  X,
  Loader2,
  Mic2,
  Disc3,
  ListMusic,
  History,
  ChevronRight,
  Flame,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Input } from "@/components/ui/input";
import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import {
  useSearch,
  useSearchSuggestions,
  useTrendingSearches,
} from "@/features/search/hooks/useSearch";
import { cn } from "@/lib/utils";
import { SearchSkeleton } from "@/features/search/components/SearchSkeleton";
import { formatDuration, toCDN } from "@/utils/track-helper";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { SearchTrack, SuggestItem, useSyncInteractions } from "@/features";
import { handleError } from "@/utils/handleError";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// Static fallback — chỉ dùng khi API trending chưa load
const TRENDING_FALLBACK = [
  "Sơn Tùng M-TP",
  "Chill cùng Indie",
  "Pop Ballad",
  "Rap Việt",
  "Nhạc Trẻ",
  "Tập Gym",
  "Mới Phát Hành",
  "Lo-fi Nhẹ Nhàng",
];

const MAX_RECENT_SEARCHES = 10;
const STORAGE_KEY = "recentSearches";

const SEARCH_TABS = [
  { id: "all", label: "Tất cả", Icon: Music2 },
  { id: "track", label: "Bài hát", Icon: Music2 },
  { id: "artist", label: "Nghệ sĩ", Icon: Mic2 },
  { id: "album", label: "Đĩa nhạc", Icon: Disc3 },
  { id: "playlist", label: "Danh sách phát", Icon: ListMusic },
] as const;

type SearchTab = (typeof SEARCH_TABS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_FAST = { type: "spring", stiffness: 500, damping: 32 } as const;
const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 28 } as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.045 },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeHistory(arr: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// Highlight keyword trong suggestion label
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(
    `(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="text-primary font-bold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTION DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
const SuggestionDropdown = memo(
  ({
    suggestions,
    isLoading,
    query,
    onSelect,
    activeIndex,
  }: {
    suggestions: SuggestItem[];
    isLoading: boolean;
    query: string;
    onSelect: (item: { label: string; slug: string; type: string }) => void;
    activeIndex: number;
  }) => {
    const typeIcon = (type: string) => {
      if (type === "artist") return <Mic2 className="size-3 shrink-0" />;
      return <Music2 className="size-3 shrink-0" />;
    };

    const typeLabel = (type: string) =>
      type === "artist" ? "Nghệ sĩ" : "Bài hát";

    return (
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={SPRING_FAST}
        className={cn(
          "absolute top-[calc(100%+6px)] left-0 right-0 z-[60]",
          "rounded-xl overflow-hidden",
          "dark:bg-[#141414] bg-white",
          "border dark:border-white/[0.08] border-black/[0.08]",
          "shadow-2xl dark:shadow-black/50",
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-3 dark:text-white/35 text-gray-400">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-[13px]">Đang tìm...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-4 py-3 text-[13px] dark:text-white/35 text-gray-400">
            Không có gợi ý
          </div>
        ) : (
          <ul className="py-1.5">
            {suggestions.map((item, i) => (
              <li key={item.id}>
                <motion.button
                  onClick={() => onSelect(item)}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    activeIndex === i
                      ? "dark:bg-white/[0.07] bg-black/[0.04]"
                      : "dark:hover:bg-white/[0.04] hover:bg-black/[0.03]",
                  )}
                >
                  <SearchIcon className="size-3.5 dark:text-white/25 text-gray-400 shrink-0" />
                  <span className="flex-1 text-[13.5px] dark:text-white/80 text-gray-800 truncate">
                    {highlightMatch(item.label, query)}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                      item.type === "artist"
                        ? "dark:bg-primary/15 bg-primary/10 dark:text-primary/80 text-primary"
                        : "dark:bg-white/6 bg-black/5 dark:text-white/40 text-gray-500",
                    )}
                  >
                    {typeIcon(item.type)}
                    {typeLabel(item.type)}
                  </span>
                  <ArrowUpRight className="size-3 dark:text-white/20 text-gray-300 shrink-0" />
                </motion.button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    );
  },
);
SuggestionDropdown.displayName = "SuggestionDropdown";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(({ query, tab }: { query: string; tab: SearchTab }) => {
  const msgs: Record<SearchTab, string> = {
    all: `Không tìm thấy kết quả cho "${query}"`,
    track: `Không có bài hát nào khớp với "${query}"`,
    artist: `Không tìm thấy nghệ sĩ "${query}"`,
    album: `Không tìm thấy đĩa nhạc "${query}"`,
    playlist: `Không có playlist nào cho "${query}"`,
  };
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING_MEDIUM}
      className="flex flex-col items-center justify-center py-28 gap-5 text-center"
    >
      <div className="relative">
        <div className="size-24 rounded-full dark:bg-white/[0.04] bg-black/[0.04] border-2 border-dashed dark:border-white/10 border-black/10 flex items-center justify-center">
          <SearchIcon className="size-9 dark:text-white/20 text-gray-400" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full dark:border-white/6 border-black/6 border"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="text-lg font-black dark:text-white/85 text-gray-800 tracking-tight">
          {msgs[tab]}
        </p>
        <p className="text-sm dark:text-white/35 text-gray-500">
          Thử từ khóa khác hoặc kiểm tra chính tả
        </p>
      </div>
    </motion.div>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW
// ─────────────────────────────────────────────────────────────────────────────
// Trong file SearchPage.tsx hoặc file riêng của TrackRow Search
const TrackRow = memo(
  ({
    track,
    index,
    isCurrentPlaying,
    isActive,
    isLoadingThis,
    onPlay,
    onArtistClick,
    onMore,
    highlightHtml,
  }: {
    track: SearchTrack;
    index: number;
    isCurrentPlaying: boolean;
    isActive: boolean;
    isLoadingThis: boolean;
    onPlay: (e: React.MouseEvent) => void;
    onArtistClick: (e: React.MouseEvent) => void;
    onMore: (e: React.MouseEvent) => void;
    highlightHtml?: string;
  }) => (
    <motion.div
      custom={index}
      variants={fadeUp}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
        "transition-colors duration-150",
        isActive
          ? "bg-[hsl(var(--primary)/0.07)] hover:bg-[hsl(var(--primary)/0.1)]"
          : "",
        isCurrentPlaying
          ? "dark:bg-primary/10 bg-primary/8 shadow-sm"
          : "dark:hover:bg-white/[0.05] hover:bg-black/[0.04]",
      )}
      onClick={onPlay}
    >
      {/* Thanh nhấn mạnh bên trái khi Active */}
      {isCurrentPlaying && (
        <motion.div
          layoutId="search-track-accent"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full"
          transition={SPRING_FAST}
        />
      )}

      {/* Index / Sóng nhạc Equalizer */}
      <div className="w-6 shrink-0 flex justify-center items-center">
        {isCurrentPlaying ? (
          <div className="flex items-end gap-[2px] h-3">
            {/* Sóng nhạc mini */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-[2.5px] bg-primary rounded-full origin-bottom"
                animate={{ scaleY: [0.3, 1, 0.4, 0.9, 0.25, 1] }}
                transition={{
                  duration: 0.8 + i * 0.1,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: i * 0.1,
                }}
                style={{ height: 12 }}
              />
            ))}
          </div>
        ) : (
          <span
            className={cn(
              "text-xs font-mono dark:text-white/28 text-gray-400 group-hover:opacity-0 transition-opacity",
              isActive
                ? "text-[hsl(var(--primary))]"
                : "text-[hsl(var(--muted-foreground))]",
            )}
          >
            {index + 1}
          </span>
        )}
      </div>

      {/* Ảnh bìa + Overlay Play */}
      <div className="relative size-11 shrink-0 rounded-lg overflow-hidden dark:bg-white/8 bg-black/6 shadow-md">
        <ImageWithFallback
          src={toCDN(track.coverImage) || track.coverImage}
          alt={track.title}
          className={cn(
            "size-full object-cover transition-transform duration-500 group-hover:scale-110",
            isCurrentPlaying && "blur-[1px] opacity-80",
          )}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center dark:bg-black/40 bg-black/30 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          animate={{
            opacity:
              isLoadingThis || (isCurrentPlaying && !isLoadingThis) ? 1 : 0,
          }}
        >
          <AnimatePresence mode="wait">
            {isLoadingThis ? (
              <Loader2 className="size-4 text-white animate-spin" />
            ) : isCurrentPlaying ? (
              <Pause className="size-4 text-white fill-white" />
            ) : (
              <Play className="size-4 text-white fill-white ml-0.5" />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Thông tin bài hát + Highlight */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13.5px] font-bold truncate leading-tight transition-colors",
            isActive
              ? "text-primary"
              : "dark:text-white/90 text-gray-900 group-hover:text-primary",
          )}
          // FIX: Hiển thị bôi đậm từ khóa từ Backend
          dangerouslySetInnerHTML={{ __html: highlightHtml || track.title }}
        />
        <p
          className="text-[12px] dark:text-white/40 text-gray-500 truncate mt-1 hover:underline w-fit transition-colors hover:dark:text-white/70 hover:text-gray-700 cursor-pointer"
          onClick={onArtistClick}
        >
          {track.artist?.name ?? "Nghệ sĩ ẩn danh"}
        </p>
      </div>
      <TrackLikeButton id={track._id} />

      {/* Album (Ẩn trên mobile) */}
      <p className="hidden md:block text-[12px] dark:text-white/30 text-gray-400 truncate max-w-[140px] shrink-0 px-4">
        {track.album?.title || "Single"}
      </p>

      {/* Duration + Nút More */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:block text-[11px] font-mono dark:text-white/30 text-gray-400 tabular-nums">
          {formatDuration(track.duration ?? 0)}
        </span>
        <button
          onClick={onMore}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-gray-400 hover:text-primary"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </motion.div>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP RESULT CARD
// ─────────────────────────────────────────────────────────────────────────────
const TopResultCard = memo(
  ({
    item,
    isCurrentPlaying,
    isLoadingThis,
    onNavigate,
    onPlay,
  }: {
    item: any;
    isCurrentPlaying: boolean;
    isLoadingThis: boolean;
    onNavigate: () => void;
    onPlay: (e: React.MouseEvent) => void;
  }) => {
    const isArtist = item.type === "artist";
    return (
      <motion.div
        variants={fadeUp}
        custom={0}
        className="h-full flex flex-col gap-3.5"
      >
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
          Kết quả hàng đầu
        </h2>
        <motion.div
          onClick={onNavigate}
          whileHover={{ scale: 1.012 }}
          transition={SPRING_MEDIUM}
          className={cn(
            "group relative flex-1 flex flex-col justify-end p-6 rounded-2xl overflow-hidden cursor-pointer",
            "dark:bg-white/[0.04] bg-black/[0.03]",
            "border dark:border-white/[0.06] border-black/[0.06]",
            "dark:hover:border-primary/30 hover:border-primary/25",
            "transition-colors duration-300 min-h-[220px]",
            "shadow-sm hover:shadow-lg",
          )}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

          <div
            className={cn(
              "absolute top-6 left-6 shadow-xl transition-transform duration-500 group-hover:scale-[1.04]",
              isArtist
                ? "size-24 rounded-full border-2 dark:border-white/10 border-black/10"
                : "size-24 rounded-xl",
              "overflow-hidden",
            )}
          >
            <ImageWithFallback
              src={isArtist ? item.avatar : item.coverImage}
              alt={item.name ?? item.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 mt-28 flex flex-col gap-2">
            <h3 className="text-2xl font-black tracking-tight dark:text-white text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">
              {item.name ?? item.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full dark:bg-white/8 bg-black/6 dark:text-white/55 text-gray-600">
                {isArtist ? "Nghệ sĩ" : "Bài hát"}
              </span>
              {!isArtist && item.artist?.name && (
                <span className="text-sm dark:text-white/45 text-gray-500 truncate">
                  {item.artist.name}
                </span>
              )}
            </div>
          </div>

          {!isArtist && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(e);
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING_FAST}
              disabled={isLoadingThis}
              className={cn(
                "absolute bottom-5 right-5 z-10",
                "flex items-center justify-center size-13 rounded-full",
                "bg-primary text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
                "group-hover:opacity-100 translate-y-2 group-hover:translate-y-0",
                "transition-all duration-250",
                isCurrentPlaying && "opacity-100 translate-y-0",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoadingThis ? (
                  <motion.span
                    key="l"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="size-5 animate-spin" />
                  </motion.span>
                ) : isCurrentPlaying ? (
                  <motion.span
                    key="pa"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={SPRING_FAST}
                  >
                    <Pause className="size-5 fill-current" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="pl"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={SPRING_FAST}
                  >
                    <Play className="size-5 fill-current ml-0.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    );
  },
);
TopResultCard.displayName = "TopResultCard";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = memo(
  ({
    title,
    showMore,
    onMore,
  }: {
    title: string;
    showMore?: boolean;
    onMore?: () => void;
  }) => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
        {title}
      </h2>
      {showMore && (
        <motion.button
          onClick={onMore}
          whileHover={{ x: 2 }}
          transition={SPRING_FAST}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] dark:text-white/40 text-gray-500 hover:text-primary transition-colors"
        >
          Xem tất cả <ChevronRight className="size-3.5" />
        </motion.button>
      )}
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING TAG SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const TrendingTagSkeleton = () => (
  <div className="flex flex-wrap gap-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="h-9 rounded-full dark:bg-white/[0.05] bg-black/[0.04] animate-pulse"
        style={{ width: `${70 + (i % 3) * 30}px` }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentTrackId, isPlaying: isGlobalPlaying } =
    useAppSelector(selectPlayer);

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [localInput, setLocalInput] = useState(query);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readHistory(),
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync input với URL
  useEffect(() => {
    setLocalInput(query);
  }, [query]);

  // Reset tab khi xóa query
  useEffect(() => {
    if (!query) setActiveTab("all");
  }, [query]);

  // ── DATA HOOKS ────────────────────────────────────────────────────────────
  // Full search — debounce 400ms (trong hook)
  const { data, isLoading, isError } = useSearch(query);
  // Tại SearchPage.tsx

  // Bước 1: Gom IDs (Dùng useMemo để tránh tính toán lại mỗi lần render)
  const trackIds = useMemo(() => data?.tracks.map((t) => t._id) || [], [data]);
  const albumIds = useMemo(() => data?.albums.map((a) => a._id) || [], [data]);
  const artistIds = useMemo(
    () => data?.artists.map((a) => a._id) || [],
    [data],
  );
  const playlistIds = useMemo(
    () => data?.playlists.map((a) => a._id) || [],
    [data],
  );

  // Bước 2: Gọi Hook đồng bộ (Simple & Clean)
  // Chỉ chạy khi query không trống và có data
  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !!query && trackIds.length > 0,
  );
  useSyncInteractions(
    albumIds,
    "like",
    "album",
    !!query && albumIds.length > 0,
  );
  useSyncInteractions(
    playlistIds,
    "like",
    "playlist",
    !!query && playlistIds.length > 0,
  );
  useSyncInteractions(
    artistIds,
    "follow",
    "artist",
    !!query && artistIds.length > 0,
  );

  // Autocomplete suggestions — debounce 200ms (trong hook), chỉ kích hoạt ≥2 ký tự
  const { data: suggestionsData, isFetching: isSuggesting } =
    useSearchSuggestions(localInput);

  const suggestions = suggestionsData ?? [];

  // Trending từ Redis — staleTime 5 phút
  const { data: trendingData, isLoading: isTrendingLoading } =
    useTrendingSearches(10);

  // API trả về string[] từ Redis sorted set. Fallback sang hardcoded nếu rỗng.
  const trendingSearches: string[] =
    trendingData && trendingData?.length > 0 ? trendingData : TRENDING_FALLBACK;

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setSuggestionIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── HISTORY HELPERS ──────────────────────────────────────────────────────
  const saveToHistory = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      const next = [
        t,
        ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);
      writeHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setRecentSearches([]);
    writeHistory([]);
    toast.success("Đã xóa lịch sử tìm kiếm");
  }, []);

  // ── INPUT HANDLERS ────────────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalInput(val);
      setSuggestionIndex(-1);
      // Hiện suggestion khi gõ ≥2 ký tự
      setShowSuggestions(val.trim().length >= 2);
      if (val.trim()) setSearchParams({ q: val });
      else setSearchParams({});
    },
    [setSearchParams],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSuggestionIndex((i) => Math.max(i - 1, -1));
          return;
        }
        if (e.key === "Enter" && suggestionIndex >= 0) {
          e.preventDefault();
          const selected = suggestions[suggestionIndex];
          handleSuggestionSelect(selected);
          return;
        }
        if (e.key === "Escape") {
          setShowSuggestions(false);
          setSuggestionIndex(-1);
          return;
        }
      }

      if (e.key === "Enter" && localInput.trim()) {
        saveToHistory(localInput);
        setShowSuggestions(false);
      }
      if (e.key === "Escape") {
        setLocalInput("");
        setSearchParams({});
        setShowSuggestions(false);
      }
    },
    [
      localInput,
      saveToHistory,
      setSearchParams,
      showSuggestions,
      suggestions,
      suggestionIndex,
    ],
  );

  const handleSuggestionSelect = useCallback(
    (item: { label: string; slug: string; type: string }) => {
      setLocalInput(item.label);
      setSearchParams({ q: item.label });
      saveToHistory(item.label);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      // Điều hướng thẳng nếu là artist
      if (item.type === "artist") {
        navigate(`/artists/${item.slug}`);
      }
    },
    [setSearchParams, saveToHistory, navigate],
  );

  const handleTagClick = useCallback(
    (term: string) => {
      setSearchParams({ q: term });
      saveToHistory(term);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [setSearchParams, saveToHistory],
  );

  const clearSearch = useCallback(() => {
    setLocalInput("");
    setSearchParams({});
    setActiveTab("all");
    setShowSuggestions(false);
    setSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [setSearchParams]);

  const handleResultClick = useCallback(
    (url: string) => {
      if (query) saveToHistory(query);
      navigate(url);
    },
    [query, saveToHistory, navigate],
  );

  const handleInputFocus = useCallback(() => {
    if (localInput.trim().length >= 2) setShowSuggestions(true);
  }, [localInput]);

  // ── PLAY TRACK ────────────────────────────────────────────────────────────
  // Inside SearchPage component
  const handlePlayTrack = useCallback(
    async (e: React.MouseEvent, track: SearchTrack) => {
      e.preventDefault();
      e.stopPropagation();

      // 1. Nếu bài này đang phát rồi -> Toggle Play/Pause
      if (currentTrackId === track._id) {
        dispatch(setIsPlaying(!isGlobalPlaying));
        return;
      }

      // 2. Lưu vào lịch sử tìm kiếm
      if (query) saveToHistory(query);

      // 3. Set Queue với danh sách kết quả tìm kiếm hiện tại
      setLoadingId(track._id);
      try {
        // Lấy toàn bộ danh sách track đang hiển thị ở Tab hiện tại để làm Queue
        const tracksInQueue = data?.tracks || [];
        const trackIds = tracksInQueue.map((t) => t._id);
        const currentIndex = tracksInQueue.findIndex(
          (t) => t._id === track._id,
        );

        dispatch(
          setQueue({
            trackIds,
            initialMetadata: tracksInQueue, // Backend search v4 đã trả đủ metadata cơ bản
            startIndex: currentIndex !== -1 ? currentIndex : 0,
            source: {
              id: `search-${query}`,
              type: "search",
              title: `Kết quả cho: ${query}`,
            },
          }),
        );
        dispatch(setIsPlaying(true));
      } catch (err) {
        handleError(err, "Không thể phát bài hát này");
      } finally {
        setLoadingId(null);
      }
    },
    [currentTrackId, isGlobalPlaying, query, data, dispatch, saveToHistory],
  );

  // ── isNoResults ───────────────────────────────────────────────────────────
  const isNoResults = useMemo(() => {
    if (isLoading || !query || !data) return false;
    const d = data ?? data; // hỗ trợ cả {status, data} và data thẳng
    const checks: Record<SearchTab, boolean> = {
      all:
        !d.topResult &&
        !d.tracks?.length &&
        !d.artists?.length &&
        !d.albums?.length &&
        !d.playlists?.length,
      track: !d.tracks?.length,
      artist: !d.artists?.length,
      album: !d.albums?.length,
      playlist: !d.playlists?.length,
    };
    return checks[activeTab];
  }, [data, isLoading, query, activeTab]);

  // Normalize data shape (API trả {status, data: {...}})
  const searchResult = useMemo(() => {
    if (!data) return null;
    return data ?? [];
  }, [data]);

  // ── TAB DIRECTION ─────────────────────────────────────────────────────────
  const tabOrder = SEARCH_TABS.map((t) => t.id);
  const [tabDir, setTabDir] = useState(1);

  const switchTab = useCallback(
    (id: SearchTab) => {
      const prev = tabOrder.indexOf(activeTab);
      const next = tabOrder.indexOf(id);
      setTabDir(next > prev ? 1 : -1);
      setActiveTab(id);
    },
    [activeTab, tabOrder],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen dark:bg-[#0a0a0a] bg-gray-50/50 pb-36">
      {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "sticky top-[56px] lg:top-[64px] z-50",
          "dark:bg-[#0a0a0a]/90 bg-gray-50/90 backdrop-blur-2xl",
          "border-b dark:border-white/[0.06] border-black/[0.07]",
          "pb-0",
        )}
      >
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-3 sm:pb-4">
          {/* Search input + suggestion dropdown */}
          <div className="relative group w-full max-w-2xl mx-auto lg:mx-0">
            <SearchIcon
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 size-4 sm:size-5 z-10 transition-colors duration-200 pointer-events-none",
                localInput
                  ? "dark:text-white/60 text-gray-600"
                  : "dark:text-white/25 text-gray-400 group-focus-within:dark:text-white/60 group-focus-within:text-gray-600",
              )}
            />
            <Input
              ref={inputRef}
              value={localInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              placeholder="Tìm bài hát, nghệ sĩ, album..."
              autoFocus
              className={cn(
                "pl-10 sm:pl-11 pr-10 h-11 sm:h-12 text-sm sm:text-base font-medium w-full",
                "rounded-xl dark:bg-white/[0.06] bg-white dark:text-white text-gray-900",
                "dark:border-white/[0.08] border-black/[0.08] border",
                "dark:placeholder:text-white/25 placeholder:text-gray-400",
                "dark:focus-visible:ring-white/12 focus-visible:ring-black/8 focus-visible:ring-2",
                "dark:focus-visible:border-white/20 focus-visible:border-black/20",
                "transition-all",
              )}
            />
            <AnimatePresence>
              {localInput && (
                <motion.button
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={SPRING_FAST}
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-6 rounded-full dark:bg-white/10 bg-black/8 dark:text-white/60 text-gray-600 hover:dark:bg-white/18 hover:bg-black/14 transition-colors"
                >
                  <X className="size-3.5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Autocomplete Dropdown */}
            <AnimatePresence>
              {showSuggestions && localInput.trim().length >= 2 && (
                <div ref={dropdownRef}>
                  <SuggestionDropdown
                    suggestions={suggestions}
                    isLoading={isSuggesting && suggestions.length === 0}
                    query={localInput}
                    onSelect={handleSuggestionSelect}
                    activeIndex={suggestionIndex}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Tabs */}
          <AnimatePresence>
            {query && !isLoading && !isError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div
                  className="flex gap-1.5 mt-3 pb-3 overflow-x-auto"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {SEARCH_TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => switchTab(tab.id)}
                        whileTap={{ scale: 0.95 }}
                        transition={SPRING_FAST}
                        className={cn(
                          "relative shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors duration-200 whitespace-nowrap",
                          isActive
                            ? "dark:text-white text-gray-900"
                            : "dark:text-white/45 text-gray-500 hover:dark:text-white/70 hover:text-gray-700",
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="tab-pill"
                            className="absolute inset-0 rounded-full dark:bg-white/12 bg-black/8"
                            transition={SPRING_FAST}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <AnimatePresence mode="wait">
          {/* STATE 1: EMPTY QUERY — Recent + Trending (từ API) */}
          {!query && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING_MEDIUM}
              className="max-w-2xl space-y-10 mt-2"
            >
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 dark:text-white/55 text-gray-600">
                      <Clock className="size-4 text-primary" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                        Lịch sử
                      </span>
                    </div>
                    <button
                      onClick={clearAllHistory}
                      className="text-[11px] font-bold dark:text-white/28 text-gray-400 hover:text-destructive transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, i) => (
                      <motion.div
                        key={term}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...SPRING_FAST, delay: i * 0.03 }}
                        className={cn(
                          "group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full cursor-pointer",
                          "dark:bg-white/[0.06] bg-white border dark:border-white/[0.08] border-black/[0.08]",
                          "dark:hover:border-primary/30 hover:border-primary/25 transition-all duration-200",
                          "text-[13px] dark:text-white/70 text-gray-700 font-medium",
                        )}
                        onClick={() => handleTagClick(term)}
                      >
                        <History className="size-3 dark:text-white/30 text-gray-400 shrink-0" />
                        <span>{term}</span>
                        <button
                          onClick={(e) => removeHistoryItem(e, term)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 dark:hover:text-white hover:text-gray-900"
                        >
                          <X className="size-3" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending — dùng data từ Redis qua useTrendingSearches */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 dark:text-white/55 text-gray-600">
                  <Flame className="size-4 text-primary" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                    Đang thịnh hành
                  </span>
                  {/* Badge thể hiện data live */}
                  {trendingData &&
                    trendingData?.length > 0 &&
                    !isTrendingLoading && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary"
                      >
                        Live
                      </motion.span>
                    )}
                </div>

                {isTrendingLoading ? (
                  <TrendingTagSkeleton />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((term, i) => (
                      <motion.button
                        key={term}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_MEDIUM, delay: i * 0.04 }}
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleTagClick(term)}
                        className={cn(
                          "group flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold",
                          "dark:bg-white/[0.06] bg-white border dark:border-white/[0.08] border-black/[0.08]",
                          "dark:text-white/65 text-gray-700",
                          "dark:hover:border-primary/35 hover:border-primary/30",
                          "dark:hover:text-white hover:text-primary",
                          "transition-colors duration-200 shadow-sm",
                        )}
                      >
                        <TrendingUp className="size-3 group-hover:opacity-100 transition-opacity text-primary" />
                        {term}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STATE 2: LOADING */}
          {query && isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <SearchSkeleton />
            </motion.div>
          )}

          {/* STATE 3: ERROR */}
          {query && isError && !isLoading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING_MEDIUM}
              className="flex flex-col items-center justify-center py-28 gap-5 text-center"
            >
              <div className="size-20 rounded-full dark:bg-destructive/10 bg-red-50 border dark:border-destructive/20 border-red-200 flex items-center justify-center">
                <X className="size-7 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <p className="text-lg font-black dark:text-white/85 text-gray-800">
                  Lỗi kết nối
                </p>
                <p className="text-sm dark:text-white/35 text-gray-500">
                  Không thể lấy kết quả tìm kiếm
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="rounded-full font-bold"
              >
                Thử lại
              </Button>
            </motion.div>
          )}

          {/* STATE 4: NO RESULTS */}
          {query && !isLoading && !isError && isNoResults && (
            <EmptyState
              key={`empty-${activeTab}`}
              query={query}
              tab={activeTab}
            />
          )}

          {/* STATE 5: RESULTS */}
          {query && !isLoading && !isError && !isNoResults && searchResult && (
            <motion.div
              key={`results-${activeTab}`}
              custom={tabDir}
              initial={{ opacity: 0, x: tabDir * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDir * -20 }}
              transition={SPRING_MEDIUM}
              className="space-y-10 mt-2"
            >
              {/* ── TOP RESULT + TRACKS ── */}
              {(activeTab === "all" || activeTab === "track") && (
                <div
                  className={cn(
                    "grid gap-6 lg:gap-8",
                    activeTab === "all" && searchResult?.topResult
                      ? "grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]"
                      : "grid-cols-1",
                  )}
                >
                  {activeTab === "all" && searchResult?.topResult && (
                    <TopResultCard
                      item={searchResult.topResult}
                      isCurrentPlaying={
                        isGlobalPlaying &&
                        currentTrackId === searchResult.topResult._id
                      }
                      isLoadingThis={loadingId === searchResult.topResult._id}
                      onNavigate={() =>
                        handleResultClick(
                          searchResult?.topResult?.type === "artist"
                            ? `/artists/${searchResult.topResult.slug ?? searchResult.topResult._id}`
                            : ``,
                        )
                      }
                      onPlay={(e) =>
                        handlePlayTrack(e, searchResult?.topResult)
                      }
                    />
                  )}

                  {searchResult?.tracks?.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <SectionHeader
                        title="Bài hát"
                        showMore={
                          activeTab === "all" && searchResult.tracks.length > 4
                        }
                        onMore={() => switchTab("track")}
                      />
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className={cn(
                          "flex flex-col",
                          activeTab === "track" &&
                            "md:grid md:grid-cols-2 md:gap-x-4",
                        )}
                      >
                        {(activeTab === "all"
                          ? searchResult.tracks.slice(0, 5)
                          : searchResult.tracks
                        ).map((track: any, i: number) => (
                          <TrackRow
                            key={track._id}
                            track={track}
                            index={i}
                            isCurrentPlaying={
                              isGlobalPlaying && currentTrackId === track._id
                            }
                            isActive={currentTrackId === track._id}
                            isLoadingThis={loadingId === track._id}
                            highlightHtml={track.highlightHtml}
                            onPlay={(e) => handlePlayTrack(e, track)}
                            onArtistClick={(e) => {
                              e.stopPropagation();
                              handleResultClick(
                                `/artists/${track.artist?.slug}`,
                              );
                            }}
                            onMore={(e) => e.stopPropagation()}
                          />
                        ))}
                      </motion.div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ARTISTS ── */}
              {(activeTab === "all" || activeTab === "artist") &&
                searchResult?.artists?.length > 0 && (
                  <div>
                    <SectionHeader
                      title="Nghệ sĩ"
                      showMore={
                        activeTab === "all" && searchResult.artists.length > 6
                      }
                      onMore={() => switchTab("artist")}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {(activeTab === "all"
                        ? searchResult.artists.slice(0, 6)
                        : searchResult.artists
                      ).map((artist: any) => (
                        <div
                          key={artist._id}
                          onClick={() => saveToHistory(query)}
                        >
                          <PublicArtistCard artist={artist} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── ALBUMS ── */}
              {(activeTab === "all" || activeTab === "album") &&
                searchResult?.albums?.length > 0 && (
                  <div>
                    <SectionHeader
                      title="Đĩa nhạc"
                      showMore={
                        activeTab === "all" && searchResult.albums.length > 5
                      }
                      onMore={() => switchTab("album")}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                      {(activeTab === "all"
                        ? searchResult.albums.slice(0, 5)
                        : searchResult.albums
                      ).map((album: any) => (
                        <div
                          key={album._id}
                          onClick={() => saveToHistory(query)}
                        >
                          <PublicAlbumCard album={album} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── PLAYLISTS ── */}
              {(activeTab === "all" || activeTab === "playlist") &&
                searchResult?.playlists?.length > 0 && (
                  <div>
                    <SectionHeader
                      title="Danh sách phát"
                      showMore={
                        activeTab === "all" && searchResult.playlists.length > 5
                      }
                      onMore={() => switchTab("playlist")}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                      {(activeTab === "all"
                        ? searchResult.playlists.slice(0, 5)
                        : searchResult.playlists
                      ).map((pl: any) => (
                        <div key={pl._id} onClick={() => saveToHistory(query)}>
                          <PublicPlaylistCard playlist={pl} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
