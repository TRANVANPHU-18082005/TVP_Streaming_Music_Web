// src/features/search/hooks/useSearchPage.ts
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import {
  useSearch,
  useSearchSuggestions,
  useTrendingSearches,
} from "@/features/search/hooks/useSearch";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { handleError } from "@/utils/handleError";
import { useSyncInteractions } from "@/features/interaction";
import { ITrack } from "@/features/track";
import {
  SEARCH_TABS,
  SearchTab,
  SuggestItem,
  TRENDING_FALLBACK,
} from "@/features/search";

import { useSearchHistory } from "./useSearchHistory";

// 🚀 TỐI ƯU 1: Đẩy mảng tĩnh ra rìa file để JavaScript chỉ khởi tạo duy nhất 1 lần khi chạy app, cứu RAM tuyệt đối
const TAB_ORDER = SEARCH_TABS.map((t) => t.id);

export function useSearchPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentTrackId, isPlaying: isGlobalPlaying } =
    useAppSelector(selectPlayer);

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [localInput, setLocalInput] = useState(query);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [tabDir, setTabDir] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { recentSearches, saveToHistory, removeHistoryItem, clearAllHistory } =
    useSearchHistory();

  // ── Sync input với URL khi người dùng chuyển trang hoặc click từ ngoài vào ──
  useEffect(() => {
    setLocalInput(query);
    if (!query) setActiveTab("all");
  }, [query]);

  // 🚀 TỐI ƯU 2: HIỆU ỨNG DEBOUNCE - Trì hoãn cập nhật URL 350ms để gom request mạng
  useEffect(() => {
    // Nếu chữ trong ô input trùng với query trên URL thì không làm gì cả
    if (localInput.trim() === query) return;

    const timer = setTimeout(() => {
      if (localInput.trim()) {
        setSearchParams({ q: localInput }, { replace: true });
      } else {
        setSearchParams({});
      }
    }, 350); // Khoảng thời gian vàng cho trải nghiệm tìm kiếm mượt mà

    return () => clearTimeout(timer);
  }, [localInput, query, setSearchParams]);

  // ── Luồng gọi dữ liệu chính thống ────────────────────────────────────────────
  const { data, isLoading, isError } = useSearch(query);

  const trackIds = useMemo(
    () => data?.tracks.map((t) => t._id) ?? [],
    [data?.tracks],
  );
  const albumIds = useMemo(
    () => data?.albums.map((a) => a._id) ?? [],
    [data?.albums],
  );
  const artistIds = useMemo(
    () => data?.artists.map((a) => a._id) ?? [],
    [data?.artists],
  );
  const playlistIds = useMemo(
    () => data?.playlists.map((a) => a._id) ?? [],
    [data?.playlists],
  );

  // 🚀 TỐI ƯU 3: Đồng bộ trạng thái tim gọn gàng bằng cờ !isLoading chính xác
  useSyncInteractions(trackIds, "like", "track", !isLoading);
  useSyncInteractions(albumIds, "like", "album", !isLoading);
  useSyncInteractions(playlistIds, "like", "playlist", !isLoading);
  useSyncInteractions(artistIds, "follow", "artist", !isLoading);

  const { data: suggestionsData, isFetching: isSuggesting } =
    useSearchSuggestions(localInput);
  const suggestions: SuggestItem[] = suggestionsData ?? [];

  const { data: trendingData, isLoading: isTrendingLoading } =
    useTrendingSearches(10);
  const trendingSearches: string[] = trendingData?.length
    ? trendingData
    : TRENDING_FALLBACK;

  // ── Đóng tự động Dropdown gợi ý khi click ra ngoài ────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
        setSuggestionIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Xử lý Input thay đổi lập tức tại UI ───────────────────────────────────
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalInput(val);
      setSuggestionIndex(-1);
      setShowSuggestions(val.trim().length >= 2);
      // Đã gỡ bỏ startTransition lướt URL rác ở đây
    },
    [],
  );

  const handleSuggestionSelect = useCallback(
    (item: { label: string; slug: string; type: string }) => {
      setLocalInput(item.label);
      setSearchParams({ q: item.label }); // Ăn ngay lập tức không cần đợi debounce
      saveToHistory(item.label);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      if (item.type === "artist") navigate(`/artists/${item.slug}`);
    },
    [setSearchParams, saveToHistory, navigate],
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
          handleSuggestionSelect(suggestions[suggestionIndex]);
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
        setSearchParams({ q: localInput }); // Thực thi tìm kiếm ngay lập tức khi nhấn Enter
        setShowSuggestions(false);
      }
      if (e.key === "Escape") {
        clearSearch();
      }
    },
    [
      showSuggestions,
      suggestions,
      localInput,
      suggestionIndex,
      saveToHistory,
      setSearchParams,
      handleSuggestionSelect,
    ],
  );

  const handleTagClick = useCallback(
    (term: string) => {
      setLocalInput(term);
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

  // ── Xử lý chuyển đổi thanh Tab ─────────────────────────────────────────────
  const switchTab = useCallback(
    (id: SearchTab) => {
      const prev = TAB_ORDER.indexOf(activeTab);
      const next = TAB_ORDER.indexOf(id);
      setTabDir(next > prev ? 1 : -1);
      setActiveTab(id);
    },
    [activeTab],
  );

  // ── Xử lý phát bài hát từ hàng kết quả ───────────────────────────────────
  // 🚀 TỐI ƯU 4: Loại bỏ useMemo bọc data thừa thãi
  const searchResult = data ?? null;

  const handlePlayTrack = useCallback(
    async (e: React.MouseEvent, track: ITrack) => {
      e.preventDefault();
      e.stopPropagation();

      if (currentTrackId === track._id) {
        dispatch(setIsPlaying(!isGlobalPlaying));
        return;
      }
      if (query) saveToHistory(query);

      setLoadingId(track._id);
      try {
        let tracksInQueue = searchResult?.tracks ?? [];
        let ids = tracksInQueue.map((t: ITrack) => t._id);
        let startIndex = ids.indexOf(track._id);

        if (startIndex === -1) {
          tracksInQueue = [track, ...tracksInQueue];
          ids = [track._id, ...ids];
          startIndex = 0;
        }

        dispatch(
          setQueue({
            trackIds: ids,
            initialMetadata: tracksInQueue,
            startIndex,
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

  // ── Flag kiểm tra không có kết quả ─────────────────────────────────────────
  const isNoResults = useMemo(() => {
    if (isLoading || !query || !data) return false;
    const checks: Record<SearchTab, boolean> = {
      all:
        !data.topResult &&
        !data.tracks?.length &&
        !data.artists?.length &&
        !data.albums?.length &&
        !data.playlists?.length &&
        !data.genres?.length,
      track: !data.tracks?.length,
      artist: !data.artists?.length,
      album: !data.albums?.length,
      playlist: !data.playlists?.length,
      genre: !data.genres?.length,
    };
    return checks[activeTab];
  }, [data, isLoading, query, activeTab]);

  return {
    inputRef,
    dropdownRef,
    query,
    localInput,
    activeTab,
    tabDir,
    switchTab,
    suggestions,
    isSuggesting,
    showSuggestions,
    suggestionIndex,
    trendingSearches,
    trendingData,
    isTrendingLoading,
    recentSearches,
    saveToHistory,
    removeHistoryItem,
    clearAllHistory,
    searchResult,
    isLoading,
    isError,
    isNoResults,
    loadingId,
    currentTrackId,
    isGlobalPlaying,
    handleInputChange,
    handleInputFocus,
    handleKeyDown,
    handleSuggestionSelect,
    handleTagClick,
    clearSearch,
    handleResultClick,
    handlePlayTrack,
  };
}
