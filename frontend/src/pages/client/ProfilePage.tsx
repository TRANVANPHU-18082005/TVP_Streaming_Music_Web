import {
  useState,
  useMemo,
  useCallback,
  memo,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Edit,
  Heart,
  Plus,
  Calendar,
  Camera,
  Music2,
  History,
  BarChart3,
  ListMusic,
  Disc,
  UserCircle2,
  Disc3,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Shield,
  Headphones,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";
import { formatDate } from "@/utils/track-helper";
import { useProfileDashboard } from "@/features/profile/hooks/useProfileQuery";
import UserPlaylistModal from "@/features/playlist/components/UserPlaylistModal";
import { cn } from "@/lib/utils";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import PlaylistCardSkeleton from "@/features/playlist/components/PlaylistCardSkeleton";
import MusicResult from "@/components/ui/Result";
import { IPlaylist, useMyPlaylists } from "@/features/playlist";
import { IAlbum, PublicAlbumCard } from "@/features/album";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IArtist, useMyFollowedArtists } from "@/features/artist";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { APP_CONFIG } from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

// Slide variants for tab transitions (uses custom direction: 1 => forward, -1 => backward)
const slideVariants = {
  hidden: (dir: number) => ({ opacity: 0, x: 72 * dir }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.36, ease: EASE_EXPO },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: -72 * dir,
    transition: { duration: 0.22, ease: EASE_EXPO },
  }),
};

// Lazy-loaded subcomponents to reduce initial bundle and improve TTI
const ProfileChart = lazy(() => import("./profile/ProfileChart"));
const RecentlyPlayedTrackList = lazy(
  () => import("./profile/RecentlyPlayedTrackList"),
);
const FavouriteTrackList = lazy(() => import("./profile/FavouriteTrackList"));
// Lazy-load heavy playlist card to reduce initial bundle
const PublicPlaylistCard = lazy(
  () => import("@/features/playlist/components/PublicPlaylistCard"),
);
// Lazy-load public artist card
const PublicArtistCard = lazy(
  () => import("@/features/artist/components/PublicArtistCard"),
);

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = memo(() => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <div className="absolute inset-0 bg-background" />
    <div
      className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--primary)/0.07) 0%, hsl(var(--primary)/0.03) 40%, transparent 100%)",
      }}
    />
    <div
      className="absolute inset-0 opacity-[0.022] mix-blend-overlay pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
  </div>
));
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// HERO BACKDROP
// ─────────────────────────────────────────────────────────────────────────────
const HeroBackdrop = memo(({ src }: { src?: string }) => (
  <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    {src && (
      <ImageWithFallback
        src={src}
        alt=""
        className="w-full h-full object-cover opacity-[0.15] blur-[60px] scale-110 saturate-[1.4]"
        loading="eager"
      />
    )}
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, hsl(var(--background)/0.6) 55%, hsl(var(--background)) 100%)",
      }}
    />
  </div>
));
HeroBackdrop.displayName = "HeroBackdrop";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = memo(
  ({
    icon: Icon,
    eyebrow,
    title,
    iconColor,
    action,
  }: {
    icon: React.ElementType;
    eyebrow: string;
    title: string;
    iconColor?: string;
    action?: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary"
            style={
              iconColor
                ? { color: iconColor, background: `${iconColor}18` }
                : undefined
            }
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
          <span
            className="text-overline text-primary"
            style={iconColor ? { color: iconColor } : undefined}
          >
            {eyebrow}
          </span>
        </div>
        <h2 className="text-section-title text-foreground leading-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(
  ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ElementType;
    title: string;
    description?: string;
  }) => (
    <div className="col-span-full flex flex-col items-center justify-center min-h-[180px] gap-3 text-center animate-fade-in py-8">
      <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground/40">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const LoadingState = memo(() => (
  <div className="relative min-h-screen pb-28">
    <AmbientBackground />
    <div className="relative h-[40vh] min-h-[280px] flex items-end">
      <div className="section-container pb-8 w-full">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="skeleton skeleton-avatar size-32 sm:size-44 shrink-0" />
          <div className="flex-1 space-y-3 w-full">
            <div className="skeleton skeleton-pill w-20 h-4 mx-auto sm:mx-0" />
            <div className="skeleton w-56 h-10 rounded-lg mx-auto sm:mx-0" />
            <div className="skeleton w-48 h-4 rounded mx-auto sm:mx-0" />
          </div>
        </div>
      </div>
    </div>
    <div className="section-container mt-4">
      <div className="flex gap-6 border-b border-border/30 pb-3 mb-8">
        {[80, 72, 88].map((w, i) => (
          <div
            key={i}
            className="skeleton skeleton-pill h-4"
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          <div className="skeleton rounded-2xl h-64 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton rounded-lg h-14 w-full" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="skeleton rounded-2xl h-48 w-full" />
          <div className="skeleton rounded-2xl h-36 w-full" />
        </div>
      </div>
    </div>
  </div>
));
LoadingState.displayName = "LoadingState";

// ─────────────────────────────────────────────────────────────────────────────
// GUEST STATE
// ─────────────────────────────────────────────────────────────────────────────
const GuestState = memo(() => (
  <div className="relative min-h-screen pb-28">
    <AmbientBackground />
    <div className="relative h-[35vh] min-h-[240px] bg-gradient-to-b from-muted/30 to-transparent flex items-end">
      <div className="section-container pb-8 w-full">
        <div className="flex items-end gap-6">
          <div className="size-28 sm:size-36 rounded-full bg-muted/60 border-4 border-background flex items-center justify-center shrink-0">
            <UserCircle2
              className="size-12 text-muted-foreground/40"
              aria-hidden="true"
            />
          </div>
          <div className="pb-2">
            <p className="text-overline text-muted-foreground/50 mb-2">
              Profile
            </p>
            <p className="text-display-lg text-muted-foreground/40">
              Chưa đăng nhập
            </p>
          </div>
        </div>
      </div>
    </div>
    <div className="section-container mt-10">
      <div
        className={cn("card-base p-8 max-w-md space-y-5", "border-primary/15")}
      >
        <div className="space-y-2">
          <h2 className="text-display-lg text-gradient-brand">Đăng nhập</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Đăng nhập để xem playlist, lịch sử nghe nhạc và quản lý thư viện của
            bạn.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" className="btn-primary gap-2">
            <Shield className="size-4" aria-hidden="true" />
            Đăng nhập
          </button>
          <button type="button" className="btn-outline gap-2">
            <Headphones className="size-4" aria-hidden="true" />
            Khám phá nhạc
          </button>
        </div>
      </div>
    </div>
  </div>
));
GuestState.displayName = "GuestState";

// Chart tooltip: moved into the lazy-loaded `ProfileChart` component to reduce bundle size.

// RecentlyPlayedTrackList and FavouriteTrackList have been moved to
// lazy-loaded modules under ./profile/ to keep this file lightweight.
// See: ./profile/RecentlyPlayedTrackList.tsx and ./profile/FavouriteTrackList.tsx

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  // Controlled nested library tab (for linking directly to liked_tracks/liked_albums/etc.)
  const [libraryTab, setLibraryTab] = useState("liked_tracks");

  // Refs for scroll targets
  const heroRef = useRef<HTMLElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const playlistsRef = useRef<HTMLDivElement | null>(null);
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const artistsRef = useRef<HTMLDivElement | null>(null);

  // Read query params / location state to allow deep-linking into tabs/sections
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const { user } = useAppSelector((s) => s.auth);
  const { data: dashboard, isLoading: isDashboardLoading } =
    useProfileDashboard();
  const { data: myPlaylists, isLoading: isMyPlaylistsLoading } =
    useMyPlaylists();
  const { data: followedArtists, isLoading: isFollowedArtistsLoading } =
    useMyFollowedArtists({});
  const followedArtistsList = useMemo(
    () => followedArtists?.artists || [],
    [followedArtists],
  );
  // Normalize playlists: ensure we have a flat array and guard against unexpected shapes
  const myPlaylistsNormalized = useMemo(() => {
    if (!myPlaylists) return [] as IPlaylist[];
    if (Array.isArray(myPlaylists))
      return myPlaylists.flat(Infinity).filter(Boolean) as IPlaylist[];
    return [] as IPlaylist[];
  }, [myPlaylists]);
  // myPlaylists is used to render the user's playlists; avoid noisy logging in production
  const userInitials = useMemo(
    () =>
      user?.fullName
        ?.split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U",
    [user?.fullName],
  );

  const openCreatePlaylist = useCallback(
    () => setIsCreatePlaylistOpen(true),
    [],
  );
  const closeCreatePlaylist = useCallback(
    () => setIsCreatePlaylistOpen(false),
    [],
  );

  // Tab direction handling for animated slide transitions
  const tabOrder = useMemo(
    () => ["overview", "playlists", "followed-artists", "library"],
    [],
  );
  const prevTabRef = useRef<string>(activeTab);
  const [direction, setDirection] = useState<number>(1);

  useEffect(() => {
    const prev = prevTabRef.current;
    const prevIndex = tabOrder.indexOf(prev);
    const nextIndex = tabOrder.indexOf(activeTab);
    setDirection(nextIndex >= prevIndex ? 1 : -1);
    prevTabRef.current = activeTab;
  }, [activeTab, tabOrder]);

  // If user navigated here with ?tab=... or ?sub=... or via location.state,
  // select the appropriate tab and scroll to its section.
  useEffect(() => {
    const tabParam =
      searchParams.get("tab") ||
      searchParams.get("section") ||
      location.state?.tab;
    const subParam = searchParams.get("sub") || location.state?.sub;
    const scrollTo = searchParams.get("scroll") || location.state?.scrollTo;

    if (tabParam) {
      setActiveTab(tabParam);
    }
    if (subParam) {
      setLibraryTab(subParam);
    }

    // Small delay to allow DOM to update after tab selection
    const id = setTimeout(() => {
      let el: HTMLElement | null = null;

      const t = tabParam || scrollTo;
      if (
        t === "playlists" ||
        scrollTo === "playlists" ||
        scrollTo === "myplaylist"
      ) {
        el = playlistsRef.current;
      } else if (t === "followed-artists" || scrollTo === "followed-artists") {
        el = artistsRef.current;
      } else if (
        t === "library" ||
        (scrollTo &&
          ["liked_tracks", "liked_albums", "liked_playlists"].includes(
            scrollTo,
          ))
      ) {
        el = libraryRef.current;
      } else if (
        t === "overview" ||
        scrollTo === "overview" ||
        scrollTo === "hero"
      ) {
        el = heroRef.current as unknown as HTMLElement | null;
      }

      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          // focus for accessibility
          (el as HTMLElement).focus?.({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    }, 120);

    return () => clearTimeout(id);
    // run when params or location state change
  }, [searchParams, location]);

  // Counts for hero stats — từ dashboard (tải ngay lập tức với hero)
  const tabCounts = useMemo(
    () => ({
      playlists: myPlaylistsNormalized.length ?? 0,
      followedArtists: followedArtistsList.length ?? 0,
      likedTracks: dashboard?.library?.tracks?.length ?? 0,
      likedAlbums: dashboard?.library?.albums?.length ?? 0,
      likedPlaylists: dashboard?.library?.playlists?.length ?? 0,
    }),
    [dashboard, myPlaylistsNormalized, followedArtistsList],
  );

  const statsMax = useMemo(
    () =>
      Math.max(
        tabCounts.likedTracks,
        tabCounts.playlists,
        tabCounts.likedAlbums,
        tabCounts.followedArtists,
        1,
      ),
    [tabCounts],
  );

  // Stable stats items to avoid recreating arrays on each render
  const statsItems = useMemo(
    () => [
      {
        icon: Music2,
        label: "Bài đã thích",
        value: tabCounts.likedTracks,
        color: "hsl(var(--primary))",
      },
      {
        icon: ListMusic,
        label: "Playlist",
        value: tabCounts.playlists,
        color: "hsl(var(--wave-2))",
      },
      {
        icon: Users,
        label: "Nghệ sĩ theo dõi",
        value: tabCounts.followedArtists,
        color: "hsl(var(--wave-3))",
      },
      {
        icon: Disc,
        label: "Album đã lưu",
        value: tabCounts.likedAlbums,
        color: "hsl(var(--success))",
      },
    ],
    [tabCounts],
  );

  if (isDashboardLoading) return <LoadingState />;
  if (!user) return <GuestState />;

  return (
    <div className="relative min-h-screen pb-28">
      <AmbientBackground />

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        tabIndex={-1}
        className="relative w-full min-h-[38vh] sm:min-h-[44vh] flex items-end"
        aria-label="Profile header"
      >
        <HeroBackdrop src={user?.avatar} />

        <div className="section-container w-full pt-16 pb-10 sm:pt-20 sm:pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-8">
            {/* Avatar */}
            <motion.div
              className="relative group shrink-0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE_EXPO }}
            >
              <div className="p-[3px] rounded-full avatar-gradient">
                <Avatar className="size-32 sm:size-40 md:size-52 border-[3px] border-background shadow-floating">
                  <AvatarImage src={user?.avatar} alt={user?.fullName} />
                  <AvatarFallback className="text-4xl sm:text-5xl font-black text-white avatar-fallback-gradient">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <button
                type="button"
                aria-label="Đổi ảnh đại diện"
                className="absolute inset-[3px] rounded-full bg-black/55 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 focus-visible:opacity-100"
              >
                <Camera className="size-6 text-white" aria-hidden="true" />
              </button>
            </motion.div>

            {/* Identity */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_EXPO, delay: 0.06 }}
                className="space-y-3"
              >
                <p className="text-overline text-muted-foreground/60 uppercase tracking-[0.18em]">
                  {user?.role || "Member"}
                </p>
                <h1
                  className={cn(
                    "font-black leading-[0.9] tracking-[-0.03em]",
                    "text-[clamp(2.4rem,8vw,5rem)]",
                    "text-foreground",
                  )}
                >
                  {user?.fullName}
                </h1>

                {user?.bio && (
                  <p className="text-sm text-muted-foreground/55 italic max-w-md hidden md:block line-clamp-1">
                    {user.bio}
                  </p>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="section-container mt-0 mb-8">
        <div className="divider-fade" />
      </div>

      {/* ══ TABS ════════════════════════════════════════════════════════════ */}
      <div className="section-container mt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab rail */}
          <div className="sticky top-0 z-40 py-0 bg-background/90 backdrop-blur-2xl border-b border-border/30 overflow-x-scroll md:overflow-x-hidden scrollbar-thin">
            <TabsList className="bg-transparent w-full justify-start rounded-none h-auto p-0 gap-0">
              {(
                [
                  { value: "overview", label: "Tổng quan", icon: BarChart3 },
                  { value: "playlists", label: "Playlist", icon: ListMusic },
                  {
                    value: "followed-artists",
                    label: "Nghệ sĩ theo dõi",
                    icon: Users,
                  },
                  { value: "library", label: "Bộ sưu tập", icon: Disc3 },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "group relative px-5 sm:px-6 py-4",
                    "rounded-none bg-transparent border-0",
                    "text-sm font-semibold text-muted-foreground/70",
                    "transition-colors duration-200",
                    "data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px]",
                    "after:bg-foreground after:scale-x-0 data-[state=active]:after:scale-x-100",
                    "after:transition-transform after:duration-250 after:ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "hover:text-foreground/80 hover:bg-muted/30",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "flex items-center gap-2",
                  )}
                >
                  <Icon
                    className="size-3.5 shrink-0 hidden sm:block"
                    aria-hidden="true"
                  />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-7 sm:mt-9">
            <AnimatePresence mode="wait">
              {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
              {activeTab === "overview" && (
                <motion.div
                  ref={overviewRef}
                  tabIndex={-1}
                  key="overview"
                  variants={slideVariants}
                  custom={direction}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10"
                >
                  {/* Main column */}
                  <div className="lg:col-span-2 space-y-10">
                    {/* Analytics chart */}
                    <section aria-label="Weekly listening activity">
                      <SectionHeader
                        icon={BarChart3}
                        eyebrow="Analytics"
                        title="Hoạt động tuần này"
                        iconColor="hsl(var(--primary))"
                        action={
                          <span className="badge badge-muted text-[10px] font-semibold">
                            7 ngày qua
                          </span>
                        }
                      />
                      <div className="card-base overflow-hidden">
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30 bg-muted/8">
                          <div className="flex items-center gap-2">
                            <div
                              className="size-2 rounded-full"
                              style={{ background: "hsl(var(--primary))" }}
                              aria-hidden="true"
                            />
                            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                              Lượt nghe
                            </span>
                          </div>
                          <TrendingUp
                            className="size-4 text-muted-foreground/40"
                            aria-hidden="true"
                          />
                        </div>
                        <Suspense
                          fallback={
                            <div className="h-48 sm:h-60 p-4">
                              <div className="skeleton rounded-lg h-full" />
                            </div>
                          }
                        >
                          <ProfileChart data={dashboard?.analytics} />
                        </Suspense>
                      </div>
                    </section>

                    {/* Recently Played — infinite + virtual scroll */}
                    <section aria-label="Recently played tracks">
                      <SectionHeader
                        icon={History}
                        eyebrow="Lịch sử"
                        title="Nghe gần đây"
                        iconColor="hsl(var(--success))"
                        action={
                          <Link
                            to="/tracks/history"
                            type="button"
                            className="group flex items-center gap-1 shrink-0 mt-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                          >
                            Xem tất cả
                            <ChevronRight
                              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </Link>
                        }
                      />
                      <Suspense
                        fallback={
                          <div className="h-44">
                            <div className="skeleton rounded-lg h-full" />
                          </div>
                        }
                      >
                        <RecentlyPlayedTrackList />
                      </Suspense>
                    </section>
                  </div>

                  {/* Sidebar */}
                  <aside className="space-y-5" aria-label="Thông tin profile">
                    {/* Bio card */}
                    <div className="card-base p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-border/40 shrink-0">
                          <AvatarImage src={user?.avatar} />
                          <AvatarFallback className="text-sm font-black text-white avatar-fallback-gradient">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground leading-tight truncate">
                            {user?.fullName}
                          </p>
                          <p className="text-overline text-primary capitalize">
                            {user?.role}
                          </p>
                        </div>
                      </div>
                      <div className="divider-fade" />
                      <div>
                        <p className="text-overline text-muted-foreground/50 mb-2">
                          Tiểu sử
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                          {user?.bio || "Chưa có tiểu sử."}
                        </p>
                      </div>
                      <div className="divider-fade" />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/50 font-medium">
                        <Calendar
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        Tham gia từ {formatDate(user?.createdAt || "")}
                      </div>
                    </div>

                    {/* Stats card */}
                    <div className="card-base p-5 space-y-4">
                      <p className="text-overline text-muted-foreground/50">
                        Thống kê
                      </p>
                      <div className="space-y-4">
                        {statsItems.map(
                          ({ icon: Icon, label, value, color }) => (
                            <div key={label} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Icon
                                    className="size-3 shrink-0"
                                    style={{ color }}
                                    aria-hidden="true"
                                  />
                                  {label}
                                </div>
                                <span className="text-counter font-bold text-foreground">
                                  {value}
                                </span>
                              </div>
                              <div
                                className="progress-track"
                                style={{ height: "3px" }}
                              >
                                <div
                                  className="progress-fill transition-all duration-700 ease-out"
                                  style={{
                                    width: `${Math.min((value / statsMax) * 100, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Discovery CTA */}
                    <div className="card-base p-5 bg-gradient-to-br from-primary/8 to-transparent border-primary/15">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles
                          className="size-3.5 text-primary"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-foreground">
                          Khám phá thêm
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Tìm nhạc mới dựa trên thói quen nghe của bạn.
                      </p>
                      <Link
                        type="button"
                        to="/chart-top"
                        className="btn-outline btn-sm w-full gap-1.5"
                      >
                        <TrendingUp className="size-3.5" aria-hidden="true" />
                        Xem bảng xếp hạng
                      </Link>
                    </div>
                  </aside>
                </motion.div>
              )}

              {/* ══ PLAYLISTS ═══════════════════════════════════════════ */}
              {activeTab === "playlists" && (
                <motion.div
                  ref={playlistsRef}
                  tabIndex={-1}
                  key="playlists"
                  variants={slideVariants}
                  custom={direction}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-7"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-overline text-muted-foreground/50 mb-1">
                        Bộ sưu tập
                      </p>
                      <h2 className="text-display-lg text-foreground">
                        Playlist của tôi
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={openCreatePlaylist}
                      className="btn-primary gap-2 shrink-0"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Tạo playlist
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {isMyPlaylistsLoading ? (
                      // show skeletons while fetching user's playlists
                      Array.from({ length: 6 }).map((_, i) => (
                        <PlaylistCardSkeleton key={i} />
                      ))
                    ) : (
                      <Suspense
                        fallback={Array.from({ length: 6 }).map((_, i) => (
                          <PlaylistCardSkeleton key={i} />
                        ))}
                      >
                        {!myPlaylistsNormalized.length ? (
                          <MusicResult
                            variant="empty-playlists"
                            title="Chưa có playlists"
                            description="Tạo playlist đầu tiên để bắt đầu."
                          />
                        ) : (
                          myPlaylistsNormalized.map(
                            (p: IPlaylist, i: number) => (
                              <motion.div
                                key={p._id}
                                // avoid starting hidden due to nested AnimatePresence/tab transitions
                                initial={false}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  duration: 0.38,
                                  ease: EASE_EXPO,
                                  delay: Math.min(i * 45, 500),
                                }}
                              >
                                <PublicPlaylistCard playlist={p} />
                              </motion.div>
                            ),
                          )
                        )}
                      </Suspense>
                    )}
                  </div>
                </motion.div>
              )}
              {/* ══ FOLLOWED ARTISTS ═══════════════════════════════════════════ */}
              {activeTab === "followed-artists" && (
                <motion.div
                  ref={playlistsRef}
                  tabIndex={-1}
                  key="followed-artists"
                  variants={slideVariants}
                  custom={direction}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-7"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-overline text-muted-foreground/50 mb-1">
                        Bộ sưu tập
                      </p>
                      <h2 className="text-display-lg text-foreground">
                        Nghệ sĩ theo dõi
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {isFollowedArtistsLoading ? (
                      // show skeletons while fetching user's playlists
                      <CardSkeleton count={APP_CONFIG.GRID_LIMIT} />
                    ) : (
                      <Suspense
                        fallback={
                          <CardSkeleton count={APP_CONFIG.GRID_LIMIT} />
                        }
                      >
                        {!followedArtistsList.length ? (
                          <MusicResult
                            variant="empty-playlists"
                            title="Chưa có playlists"
                            description="Tạo playlist đầu tiên để bắt đầu."
                          />
                        ) : (
                          followedArtistsList.map(
                            (artist: IArtist, i: number) => (
                              <motion.div
                                key={artist._id}
                                // avoid starting hidden due to nested AnimatePresence/tab transitions
                                initial={false}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  duration: 0.38,
                                  ease: EASE_EXPO,
                                  delay: Math.min(i * 45, 500),
                                }}
                              >
                                <PublicArtistCard artist={artist} />
                              </motion.div>
                            ),
                          )
                        )}
                      </Suspense>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ══ LIBRARY ═════════════════════════════════════════════ */}
              {activeTab === "library" && (
                <motion.div
                  ref={libraryRef}
                  tabIndex={-1}
                  key="library"
                  variants={slideVariants}
                  custom={direction}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-7"
                >
                  <div>
                    <p className="text-overline text-muted-foreground/50 mb-1">
                      Thư viện
                    </p>
                    <h2 className="text-display-lg text-foreground">
                      Bộ sưu tập của tôi
                    </h2>
                  </div>

                  <Tabs
                    value={libraryTab}
                    onValueChange={(v) => setLibraryTab(v)}
                  >
                    <TabsList className="bg-muted/50 rounded-xl p-1 h-auto mb-7 border border-border/40 inline-flex flex-wrap gap-1">
                      {[
                        {
                          value: "liked_tracks",
                          label: "Bài hát",
                          icon: Heart,
                          count: tabCounts.likedTracks,
                        },
                        {
                          value: "liked_albums",
                          label: "Album",
                          icon: Disc,
                          count: tabCounts.likedAlbums,
                        },
                        {
                          value: "liked_playlists",
                          label: "Playlist",
                          icon: ListMusic,
                          count: tabCounts.likedPlaylists,
                        },
                      ].map(({ value, label, icon: Icon, count }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className={cn(
                            "rounded-lg flex items-center gap-1.5 px-4 py-2 text-xs font-semibold",
                            "transition-all duration-200",
                            "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                            "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          {label}
                          {count > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground/60">
                              ({count})
                            </span>
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* Liked tracks — useFavouriteTracksInfinite + virtual scroll */}
                    <TabsContent value="liked_tracks" className="mt-0">
                      <Suspense
                        fallback={
                          <div className="h-44">
                            <div className="skeleton rounded-lg h-full" />
                          </div>
                        }
                      >
                        <FavouriteTrackList />
                      </Suspense>
                    </TabsContent>

                    <TabsContent value="liked_albums" className="mt-0">
                      {!dashboard?.library?.albums?.length ? (
                        <MusicResult
                          variant="empty-albums"
                          title="Chưa có album đã lưu"
                          description="Album bạn lưu sẽ xuất hiện ở đây."
                        />
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {dashboard.library.albums.map((album: IAlbum) => (
                            <PublicAlbumCard key={album._id} album={album} />
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="liked_playlists" className="mt-0">
                      {!dashboard?.library?.playlists?.length ? (
                        <MusicResult
                          variant="empty-playlists"
                          title="Chưa có playlist đã lưu"
                          description="Playlist bạn lưu sẽ xuất hiện ở đây."
                        />
                      ) : (
                        <Suspense
                          fallback={
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                              {Array.from({
                                length: Math.min(
                                  dashboard.library.playlists.length,
                                  6,
                                ),
                              }).map((_, i) => (
                                <PlaylistCardSkeleton key={i} />
                              ))}
                            </div>
                          }
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {dashboard.library.playlists.map(
                              (playlist: IPlaylist) => (
                                <PublicPlaylistCard
                                  key={playlist._id}
                                  playlist={playlist}
                                />
                              ),
                            )}
                          </div>
                        </Suspense>
                      )}
                    </TabsContent>
                  </Tabs>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </div>

      <UserPlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={closeCreatePlaylist}
      />
    </div>
  );
};
export default ProfilePage;
