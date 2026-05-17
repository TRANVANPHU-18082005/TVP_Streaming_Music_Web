import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search as SearchIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MusicResult from "@/components/ui/Result";
import { useSearchPage } from "@/features/search/hooks/useSearchPage";
import {
  SEARCH_TABS,
  SearchSkeleton,
  SPRING_FAST,
  SPRING_MEDIUM,
} from "@/features/search";

const SearchResults = lazy(
  () => import("@/features/search/components/SearchResults"),
);
const SearchHomeState = lazy(
  () => import("@/features/search/components/SearchHomeState"),
);
const SuggestionDropdown = lazy(
  () => import("@/features/search/components/SuggestionDropdown"),
);

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_MSGS: Record<string, string> = {
  all: (q: string) => `Không tìm thấy kết quả cho "${q}"`,
  track: (q: string) => `Không có bài hát nào khớp với "${q}"`,
  artist: (q: string) => `Không tìm thấy nghệ sĩ "${q}"`,
  album: (q: string) => `Không tìm thấy đĩa nhạc "${q}"`,
  playlist: (q: string) => `Không có playlist nào cho "${q}"`,
  genre: (q: string) => `Không tìm thấy thể loại "${q}"`,
} as any;

const EmptyState = ({ query, tab }: { query: string; tab: string }) => (
  <MusicResult
    title={(EMPTY_MSGS[tab] as any)(query)}
    description="Thử từ khóa khác hoặc kiểm tra chính tả"
    variant="empty-search"
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const {
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
  } = useSearchPage();

  return (
    <div className="relative min-h-screen dark:bg-[#0a0a0a] bg-gray-50/50 pb-36">
      {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "sticky top-[56px] lg:top-[64px] z-50",
          "dark:bg-[#0a0a0a]/90 bg-gray-50/90 backdrop-blur-2xl",
          "border-b dark:border-white/[0.06] border-black/[0.07]",
        )}
      >
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-3 sm:pb-4">
          {/* Search input */}
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
                  key="clear-search-btn"
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

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showSuggestions && localInput.trim().length >= 2 && (
                <motion.div
                  ref={dropdownRef}
                  key="autocomplete-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={SPRING_FAST}
                >
                  <Suspense
                    fallback={
                      <div className="mt-6">
                        <SearchSkeleton />
                      </div>
                    }
                  >
                    <SuggestionDropdown
                      suggestions={suggestions}
                      isLoading={isSuggesting && suggestions.length === 0}
                      query={localInput}
                      onSelect={handleSuggestionSelect}
                      activeIndex={suggestionIndex}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tab bar */}
          <AnimatePresence>
            {query && !isLoading && !isError && (
              <motion.div
                key="search-tabs-bar"
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

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <AnimatePresence mode="wait">
          {/* STATE 1: no query */}
          {!query && (
            <motion.div
              key="home-state-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Suspense
                fallback={
                  <div className="mt-6">
                    <SearchSkeleton />
                  </div>
                }
              >
                <SearchHomeState
                  recentSearches={recentSearches}
                  trendingSearches={trendingSearches}
                  trendingData={trendingData}
                  isTrendingLoading={isTrendingLoading}
                  onTagClick={handleTagClick}
                  onRemoveHistory={removeHistoryItem}
                  onClearAllHistory={clearAllHistory}
                />
              </Suspense>
            </motion.div>
          )}

          {/* STATE 2: loading */}
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

          {/* STATE 3: error */}
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

          {/* STATE 4: no results */}
          {query && !isLoading && !isError && isNoResults && (
            <motion.div
              key={`empty-state-${activeTab}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              <EmptyState query={query} tab={activeTab} />
            </motion.div>
          )}

          {/* STATE 5: results */}
          {query && !isLoading && !isError && !isNoResults && searchResult && (
            <motion.div
              key="search-results-wrapper" // 🚀 FIX 6: Bọc toàn bộ khối Suspense/Lazy lại để nhận diện DOM chuẩn xác
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
