/**
 * HeroSelector.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated tab switcher + 5 thin entity connectors.
 *
 * Each connector:
 *  1. Fetches its data
 *  2. Normalises raw entities → HeroItem[]
 *  3. Owns currentIndex + direction so the playback hook sees the right item
 *  4. Calls the entity-specific playback hook
 *  5. Renders <HeroCore> — zero Hero-level code duplication
 *
 * Performance notes
 *  • Only the active connector mounts (conditional rendering, not CSS hide)
 *    → inactive hero data is not fetched / hooks not run
 *  • AnimatePresence cross-fades between types with a 200 ms fade
 *  • Tab indicator is a shared layoutId element — butter-smooth with Framer
 *  • useHeroSlider is called once per connector; direction stays local
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  lazy,
  Suspense,
} from "react";
import { Disc3, User, List, Hash, Music2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

// ── HeroCore engine ───────────────────────────────────────────────────────────

// ── Entity data hooks ─────────────────────────────────────────────────────────
import { useFeatureAlbums } from "@/features/album/hooks/useAlbumsQuery";
import { useFeaturedPlaylists } from "@/features/playlist";
import { useSpotlightArtists } from "@/features/artist";
import { useTrendingGenres } from "@/features/genre";
import { useFeaturedTracks } from "@/features/track";

// ── Entity types ──────────────────────────────────────────────────────────────
import type { IAlbum } from "@/features/album";
import type { IPlaylist } from "@/features/playlist/types";
import type { IArtist } from "@/features/artist/types";
import type { IGenre } from "@/features/genre";
import type { ITrack } from "@/features/track";

// ── Playback hooks ────────────────────────────────────────────────────────────
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectPlayer,
  setIsPlaying,
  setQueue,
} from "@/features/player/slice/playerSlice";
import { handleError } from "@/utils/handleError";

// ── Action buttons ────────────────────────────────────────────────────────────
import {
  AlbumLikeButton,
  PlaylistLikeButton,
  TrackLikeButton,
} from "@/features/interaction/components/LikeButton";
import { FollowButton } from "@/features/interaction";

// ── Shared slider hook ────────────────────────────────────────────────────────
import { useHeroSlider } from "@/hooks";

// ── Online status ─────────────────────────────────────────────────────────────
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MusicResult from "../../../components/ui/Result";
import { HeroItem, HeroPlayback } from "./Herocore";
import { HeroSkeleton } from "./HeroSkeleton";
const HeroCore = lazy(() => import("./Herocore"));

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type HeroType = "album" | "artist" | "playlist" | "genre" | "track";

interface TypeOption {
  key: HeroType;
  label: string;
  labelShort: string; // for xs screens
  Icon: React.ComponentType<{ className?: string }>;
}

const TYPE_OPTIONS: TypeOption[] = [
  { key: "album", label: "Album", labelShort: "", Icon: Disc3 },
  { key: "artist", label: "Nghệ sĩ", labelShort: "", Icon: User },
  { key: "playlist", label: "Playlist", labelShort: "", Icon: List },
  { key: "genre", label: "Thể loại", labelShort: "", Icon: Hash },
  { key: "track", label: "Bài hát", labelShort: "", Icon: Music2 },
];

const PERSIST_KEY = "hero:type";

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION HELPERS — raw entity → HeroItem
// ─────────────────────────────────────────────────────────────────────────────

const toAlbumItem = (a: IAlbum): HeroItem => ({
  id: a._id,
  slug: a.slug,
  title: a.title,
  subtitle: a.artist?.name,
  subtitlePrefix: "Trình bày bởi",
  description: a.description,
  coverImage: a.coverImage,
  themeColor: a.themeColor,
});

const toPlaylistItem = (p: IPlaylist): HeroItem => ({
  id: p._id,
  slug: p.slug,
  title: p.title,
  subtitle: "Tvp Music",
  subtitlePrefix: "Thuộc",
  description: p.description,
  coverImage: p.coverImage,
  themeColor: p.themeColor,
});

const toArtistItem = (a: IArtist): HeroItem => ({
  id: a._id,
  slug: a.slug,
  title: a.name,
  // no subtitle — the hero IS the artist
  description: a.bio,
  coverImage: a.avatar ?? a.coverImage,
  themeColor: a.themeColor,
});

const toGenreItem = (g: IGenre): HeroItem => ({
  id: g._id,
  slug: g.slug,
  title: g.name,
  description: g.description,
  coverImage: g.image,
  themeColor: g.color, // genre uses `color` — normalised here
});

const toTrackItem = (t: ITrack): HeroItem => ({
  id: t._id,
  slug: t._id, // tracks navigate by id, not slug
  title: t.title,
  subtitle: t.artist?.name,
  subtitlePrefix: "Trình bày bởi",
  description: t.description,
  coverImage: t.coverImage,
  themeColor: "var(--primary)", // tracks don't have themeColor
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SLIDER STATE HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useHeroNav(length: number) {
  const { currentIndex, nextSlide, prevSlide, goToSlide } =
    useHeroSlider(length);
  const [direction, setDirection] = useState<-1 | 1>(1);

  const onNext = useCallback(() => {
    setDirection(1);
    nextSlide();
  }, [nextSlide]);
  const onPrev = useCallback(() => {
    setDirection(-1);
    prevSlide();
  }, [prevSlide]);
  const onGoTo = useCallback(
    (i: number) => {
      setDirection(i > currentIndex ? 1 : -1);
      goToSlide(i);
    },
    [currentIndex, goToSlide],
  );

  return { currentIndex, direction, onNext, onPrev, onGoTo } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTORS — thin wrappers that own data + playback for each entity type
// ─────────────────────────────────────────────────────────────────────────────

// ── Album ─────────────────────────────────────────────────────────────────────
function AlbumConnector() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useFeatureAlbums();
  const rawItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => rawItems.map(toAlbumItem), [rawItems]);

  const nav = useHeroNav(items.length);
  const currentRaw = rawItems[nav.currentIndex];

  const { togglePlayAlbum, isThisAlbumActive, isThisAlbumPlaying, isFetching } =
    useAlbumPlayback(currentRaw);

  const playback: HeroPlayback = {
    isActive: isThisAlbumActive,
    isPlaying: isThisAlbumPlaying,
    isFetching,
    onTogglePlay: togglePlayAlbum,
  };

  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroCore
        items={items}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        {...nav}
        playback={playback}
        onNavigateItem={() =>
          currentRaw && navigate(`/albums/${currentRaw.slug}`)
        }
        onNavigateSubtitle={() =>
          currentRaw?.artist && navigate(`/artists/${currentRaw.artist.slug}`)
        }
        headerLabel="BỘ SƯU TẬP NỔI BẬT"
        badgeLabel="Album"
        actionExtra={
          currentRaw && <AlbumLikeButton id={currentRaw._id} variant="detail" />
        }
      />
    </Suspense>
  );
}

// ── Playlist ──────────────────────────────────────────────────────────────────
function PlaylistConnector() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useFeaturedPlaylists();
  const rawItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => rawItems.map(toPlaylistItem), [rawItems]);

  const nav = useHeroNav(items.length);
  const currentRaw = rawItems[nav.currentIndex];

  const {
    togglePlayPlaylist,
    isThisPlaylistActive,
    isThisPlaylistPlaying,
    isFetching,
  } = usePlaylistPlayback(currentRaw);

  const playback: HeroPlayback = {
    isActive: isThisPlaylistActive,
    isPlaying: isThisPlaylistPlaying,
    isFetching,
    onTogglePlay: togglePlayPlaylist,
  };

  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroCore
        items={items}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        {...nav}
        playback={playback}
        onNavigateItem={() =>
          currentRaw && navigate(`/playlists/${currentRaw.slug}`)
        }
        // No subtitle navigation — "Tvp Music" is static
        headerLabel="BỘ SƯU TẬP NỔI BẬT"
        badgeLabel="Playlist"
        actionExtra={
          currentRaw && (
            <PlaylistLikeButton id={currentRaw._id} variant="detail" />
          )
        }
      />
    </Suspense>
  );
}

// ── Artist ────────────────────────────────────────────────────────────────────
function ArtistConnector() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSpotlightArtists();
  const rawItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => rawItems.map(toArtistItem), [rawItems]);

  const nav = useHeroNav(items.length);
  const currentRaw = rawItems[nav.currentIndex];

  const {
    togglePlayArtist,
    isThisArtistActive,
    isThisArtistPlaying,
    isFetching,
  } = useArtistPlayback(currentRaw);

  const playback: HeroPlayback = {
    isActive: isThisArtistActive,
    isPlaying: isThisArtistPlaying,
    isFetching,
    onTogglePlay: togglePlayArtist,
  };

  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroCore
        items={items}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        {...nav}
        playback={playback}
        onNavigateItem={() =>
          currentRaw && navigate(`/artists/${currentRaw.slug}`)
        }
        headerLabel="NGHỆ SỸ NỔI BẬT"
        badgeLabel="Artist"
        actionExtra={currentRaw && <FollowButton artistId={currentRaw._id} />}
      />
    </Suspense>
  );
}

// ── Genre ─────────────────────────────────────────────────────────────────────
function GenreConnector() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTrendingGenres();
  const rawItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => rawItems.map(toGenreItem), [rawItems]);

  const nav = useHeroNav(items.length);
  const currentRaw = rawItems[nav.currentIndex];

  const { togglePlayGenre, isThisGenreActive, isThisGenrePlaying, isFetching } =
    useGenrePlayback(currentRaw);

  const playback: HeroPlayback = {
    isActive: isThisGenreActive,
    isPlaying: isThisGenrePlaying,
    isFetching,
    onTogglePlay: togglePlayGenre,
  };

  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroCore
        items={items}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        {...nav}
        playback={playback}
        onNavigateItem={() =>
          currentRaw && navigate(`/genres/${currentRaw.slug}`)
        }
        headerLabel="THỂ LOẠI NỔI BẬT"
        badgeLabel="Genre"
        // No actionExtra — genre has no like button
      />
    </Suspense>
  );
}

// ── Track ─────────────────────────────────────────────────────────────────────
function TrackConnector() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, isLoading, isError, refetch } = useFeaturedTracks();
  const rawItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => rawItems.map(toTrackItem), [rawItems]);

  const nav = useHeroNav(items.length);
  const currentRaw = rawItems[nav.currentIndex];

  const { currentTrackId, isPlaying: isGlobalPlaying } =
    useAppSelector(selectPlayer);
  const isThisTrackActive = currentTrackId === currentRaw?._id;
  const isThisTrackPlaying = isThisTrackActive && isGlobalPlaying;

  const togglePlay = useCallback(async () => {
    if (!currentRaw) return;
    if (currentTrackId === currentRaw._id) {
      dispatch(setIsPlaying(!isGlobalPlaying));
      return;
    }
    try {
      dispatch(
        setQueue({
          trackIds: [currentRaw._id],
          initialMetadata: [currentRaw],
          startIndex: 0,
          isShuffling: false,
          source: {
            id: currentRaw._id,
            type: "single",
            title: currentRaw.title,
            url: "",
          },
        }),
      );
    } catch (err) {
      handleError(err, "Không thể phát bài hát này");
    }
  }, [currentRaw, currentTrackId, isGlobalPlaying, dispatch]);

  const playback: HeroPlayback = {
    isActive: isThisTrackActive,
    isPlaying: isThisTrackPlaying,
    isFetching: isLoading,
    onTogglePlay: togglePlay,
  };

  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroCore
        items={items}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        {...nav}
        playback={playback}
        onNavigateItem={() =>
          currentRaw && navigate(`/tracks/${currentRaw._id}`)
        }
        onNavigateSubtitle={() =>
          currentRaw?.artist && navigate(`/artists/${currentRaw.artist.slug}`)
        }
        headerLabel="BÀI HÁT NỔI BẬT"
        badgeLabel="Track"
        actionExtra={currentRaw && <TrackLikeButton id={currentRaw._id} />}
      />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTOR MAP
// ─────────────────────────────────────────────────────────────────────────────

const CONNECTORS: Record<HeroType, () => ReactNode> = {
  album: () => <AlbumConnector />,
  playlist: () => <PlaylistConnector />,
  artist: () => <ArtistConnector />,
  genre: () => <GenreConnector />,
  track: () => <TrackConnector />,
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED TAB BAR
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({
  selected,
  onChange,
}: {
  selected: HeroType;
  onChange: (t: HeroType) => void;
}) {
  // Keyboard: left/right between tabs
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = TYPE_OPTIONS.findIndex((o) => o.key === selected);
      if (e.key === "ArrowRight")
        onChange(TYPE_OPTIONS[(idx + 1) % TYPE_OPTIONS.length].key);
      if (e.key === "ArrowLeft")
        onChange(
          TYPE_OPTIONS[(idx - 1 + TYPE_OPTIONS.length) % TYPE_OPTIONS.length]
            .key,
        );
    },
    [selected, onChange],
  );

  return (
    <div className="flex justify-center lg:justify-end px-4 sm:px-6 lg:px-10 mb-3 sm:mb-4">
      <nav
        ref={containerRef}
        role="tablist"
        aria-label="Chọn loại nội dung nổi bật"
        onKeyDown={handleKeyDown}
        className={cn(
          "relative inline-flex items-center gap-0.5 p-1 rounded-2xl",
          "bg-muted/20 dark:bg-white/5 backdrop-blur-sm",
          "border border-white/8 dark:border-white/10",
          "shadow-sm",
        )}
      >
        {TYPE_OPTIONS.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(opt.key)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-xl",
                "h-8 px-3 text-sm font-medium",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {/* Animated background pill */}
              {active && (
                <motion.span
                  layoutId="hero-tab-indicator"
                  className="absolute inset-0 rounded-xl bg-background/80 dark:bg-white/10 shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}

              <span className="relative z-10 flex items-center gap-1.5">
                <opt.Icon className="size-3.5 shrink-0" />
                {/* Full label on sm+; short on xs */}
                <span className="hidden xs:hidden sm:inline leading-none whitespace-nowrap">
                  {opt.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SELECTOR — exported default
// ─────────────────────────────────────────────────────────────────────────────

export default function HeroSelector({
  initialType = "album",
}: {
  initialType?: HeroType;
}) {
  const isOffline = !useOnlineStatus();

  const [selected, setSelected] = useState<HeroType>(() => {
    try {
      return (localStorage.getItem(PERSIST_KEY) as HeroType) || initialType;
    } catch {
      return initialType;
    }
  });

  const handleSelect = useCallback((type: HeroType) => {
    setSelected(type);
    try {
      localStorage.setItem(PERSIST_KEY, type);
    } catch {
      /* ignore */
    }
  }, []);

  // Global offline guard — show once at the selector level
  if (isOffline) {
    return (
      <div className="section-container py-8">
        <MusicResult variant="error-network" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Tab bar — always visible, above the hero section */}
      <TabBar selected={selected} onChange={handleSelect} />

      {/* Hero content — cross-fade on type change */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {CONNECTORS[selected]()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
