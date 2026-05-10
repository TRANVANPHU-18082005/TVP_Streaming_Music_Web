import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  lazy,
  Suspense,
  useTransition,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Search as SearchIcon,
  Music2,
  X,
  Loader2,
  Mic2,
  Disc3,
  ListMusic,
  History,
  Flame,
  Clock,
  ArrowUpRight,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  useSearch,
  useSearchSuggestions,
  useTrendingSearches,
} from "@/features/search/hooks/useSearch";
import { cn } from "@/lib/utils";
import { SearchSkeleton } from "@/features/search/components/SearchSkeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { handleError } from "@/utils/handleError";
import MusicResult from "@/components/ui/Result";
import { useSyncInteractions } from "@/features/interaction";
import { ITrack } from "@/features/track";
import { SuggestItem } from "@/features/search";

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
  { id: "genre", label: "Thể loại", Icon: Tag },
] as const;

type SearchTab = (typeof SEARCH_TABS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_FAST = { type: "spring", stiffness: 500, damping: 32 } as const;
const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 28 } as const;

// Animation variants for track/result animations were moved to the
// lazy-loaded `SearchResults` component to keep the initial bundle small.

const SearchResults = lazy(() => import("./SearchResults"));

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
    genre: `Không tìm thấy thể loại "${query}"`,
  };
  return (
    <MusicResult
      title={msgs[tab]}
      description={"Thử từ khóa khác hoặc kiểm tra chính tả"}
      variant="empty-search"
    />
  );
});
EmptyState.displayName = "EmptyState";

// Track / TopResult / SectionHeader moved to `SearchResults.tsx` (lazy-loaded)

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
  const [isPending, startTransition] = useTransition();

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
      startTransition(() => {
        if (val.trim()) setSearchParams({ q: val });
        else setSearchParams({});
      });
    },
    [setSearchParams, startTransition],
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
        startTransition(() => setSearchParams({}));
        setShowSuggestions(false);
      }
    },
    [
      showSuggestions,
      suggestions,
      localInput,
      suggestionIndex,
      saveToHistory,
      setSearchParams,
    ],
  );

  const handleSuggestionSelect = useCallback(
    (item: { label: string; slug: string; type: string }) => {
      setLocalInput(item.label);
      startTransition(() => setSearchParams({ q: item.label }));
      saveToHistory(item.label);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      // Điều hướng thẳng nếu là artist
      if (item.type === "artist") {
        navigate(`/artists/${item.slug}`);
      }
    },
    [setSearchParams, saveToHistory, navigate, startTransition],
  );

  const handleTagClick = useCallback(
    (term: string) => {
      startTransition(() => setSearchParams({ q: term }));
      saveToHistory(term);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [setSearchParams, saveToHistory],
  );

  const clearSearch = useCallback(() => {
    setLocalInput("");
    startTransition(() => setSearchParams({}));
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
  // Normalize data shape (API trả {status, data: {...}})
  const searchResult = useMemo(() => {
    if (!data) return null;
    return data ?? [];
  }, [data]);
  const handlePlayTrack = useCallback(
    async (e: React.MouseEvent, track: ITrack) => {
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
        let tracksInQueue = searchResult?.tracks || [];
        let trackIds = tracksInQueue.map((t: ITrack) => t._id);
        let currentIndex = trackIds.indexOf(track._id);

        // Nếu bài hát không nằm trong danh sách tracks (ví dụ Top Result), chèn nó lên đầu
        if (currentIndex === -1) {
          tracksInQueue = [track, ...tracksInQueue];
          trackIds = [track._id, ...trackIds];
          currentIndex = 0;
        }

        dispatch(
          setQueue({
            trackIds,
            initialMetadata: tracksInQueue, // Chèn data trả từ search.service.ts
            startIndex: currentIndex,
            source: {
              id: `search-${query}`,
              type: "search",
              title: `Kết quả cho: ${query}`,
            },
          }),
        );
      } catch (err) {
        handleError(err, "Không thể phát bài hát này");
      } finally {
        setLoadingId(null);
      }
    },
    [
      currentTrackId,
      isGlobalPlaying,
      query,
      searchResult,
      dispatch,
      saveToHistory,
    ],
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
        !d.playlists?.length &&
        !d.genres?.length,
      track: !d.tracks?.length,
      artist: !d.artists?.length,
      album: !d.albums?.length,
      playlist: !d.playlists?.length,
      genre: !d.genres?.length,
    };
    return checks[activeTab];
  }, [data, isLoading, query, activeTab]);

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
                          className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 dark:hover:text-white hover:text-gray-900"
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

          {/* STATE 5: RESULTS - lazy-loaded component to reduce initial bundle */}
          {query && !isLoading && !isError && !isNoResults && searchResult && (
            <Suspense
              fallback={
                <div className="mt-6">
                  <SearchSkeleton />
                </div>
              }
            >
              <SearchResults
                searchResult={searchResult}
                activeTab={activeTab}
                tabDir={tabDir}
                isGlobalPlaying={isGlobalPlaying}
                currentTrackId={currentTrackId}
                loadingId={loadingId}
                handlePlayTrack={handlePlayTrack}
                handleResultClick={handleResultClick}
                switchTab={switchTab}
                saveToHistory={saveToHistory}
                query={query}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
