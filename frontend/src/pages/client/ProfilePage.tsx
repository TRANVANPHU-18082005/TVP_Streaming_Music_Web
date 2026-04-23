import { useState, useMemo, useCallback, memo } from "react";
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
} from "lucide-react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  CartesianGrid,
} from "recharts";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";
import { formatDate } from "@/utils/track-helper";
import {
  useProfileDashboard,
  useFavouriteTracksInfinite,
  useRecentlyPlayedInfinite,
} from "@/features/profile/hooks/useProfileQuery";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import UserPlaylistModal from "@/features/playlist/components/UserPlaylistModal";
import { cn } from "@/lib/utils";
import {
  IAlbum,
  IMyPlaylist,
  IPlaylist,
  PublicAlbumCard,
  PublicPlaylistCard,
  TrackList,
  useMyPlaylists,
} from "@/features";
import { Link } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_EXPO } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.22, ease: EASE_EXPO } },
};

const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: EASE_EXPO } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

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
      <img
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

// ─────────────────────────────────────────────────────────────────────────────
// CHART TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-frosted rounded-xl px-3 py-2.5 shadow-floating border border-border/50 text-xs font-medium">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-foreground font-bold">{payload[0].value} lượt nghe</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RECENTLY PLAYED TRACK LIST
// Mirrors RecentlyListenedTrack's hook pattern — renders inline (no section wrapper)
// ─────────────────────────────────────────────────────────────────────────────
const RecentlyPlayedTrackList = memo(() => {
  const {
    data: tracksData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useRecentlyPlayedInfinite();

  const allTracks = useMemo(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );
  const totalItems = useMemo(
    () => tracksData?.totalItems ?? 0,
    [tracksData?.totalItems],
  );
  const allTrackIds = useMemo(() => allTracks.map((t) => t._id), [allTracks]);

  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", !isLoading);

  const trackListProps = useMemo(
    () => ({
      allTrackIds,
      tracks: allTracks,
      totalItems,
      isLoading,
      error: error as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetch,
    }),
    [
      allTrackIds,
      allTracks,
      totalItems,
      isLoading,
      error,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetch,
    ],
  );

  if (!isLoading && totalItems === 0) {
    return (
      <EmptyState
        icon={History}
        title="Chưa có lịch sử"
        description="Các bài bạn nghe sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <TrackList
      {...trackListProps}
      moodColor="primary"
      maxHeight={400}
      skeletonCount={8}
      staggerAnimation
    />
  );
});
RecentlyPlayedTrackList.displayName = "RecentlyPlayedTrackList";

// ─────────────────────────────────────────────────────────────────────────────
// FAVOURITE TRACK LIST
// Mirrors FavouriteTrack's hook pattern — renders inline (no section wrapper)
// ─────────────────────────────────────────────────────────────────────────────
const FavouriteTrackList = memo(() => {
  const {
    data: tracksData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useFavouriteTracksInfinite();

  const allTracks = useMemo(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );
  const totalItems = useMemo(
    () => tracksData?.totalItems ?? 0,
    [tracksData?.totalItems],
  );
  const allTrackIds = useMemo(() => allTracks.map((t) => t._id), [allTracks]);

  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", !isLoading);

  const trackListProps = useMemo(
    () => ({
      allTrackIds,
      tracks: allTracks,
      totalItems,
      isLoading,
      error: error as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetch,
    }),
    [
      allTrackIds,
      allTracks,
      totalItems,
      isLoading,
      error,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetch,
    ],
  );

  if (!isLoading && totalItems === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Chưa có bài đã thích"
        description="Bài hát bạn thích sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <TrackList
      {...trackListProps}
      moodColor="primary"
      maxHeight={400}
      skeletonCount={10}
      staggerAnimation
    />
  );
});
FavouriteTrackList.displayName = "FavouriteTrackList";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

  const { user } = useAppSelector((s) => s.auth);
  const { data: dashboard, isLoading: isDashboardLoading } =
    useProfileDashboard();
  const { data: myPlaylists } = useMyPlaylists();
  console.log(myPlaylists);
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

  // Counts for hero stats — từ dashboard (tải ngay lập tức với hero)
  const tabCounts = useMemo(
    () => ({
      playlists: myPlaylists?.length ?? 0,
      likedTracks: dashboard?.library?.tracks?.length ?? 0,
      likedAlbums: dashboard?.library?.albums?.length ?? 0,
      likedPlaylists: dashboard?.library?.playlists?.length ?? 0,
    }),
    [dashboard, myPlaylists],
  );

  const statsMax = useMemo(
    () =>
      Math.max(
        tabCounts.likedTracks,
        tabCounts.playlists,
        tabCounts.likedAlbums,
        1,
      ),
    [tabCounts],
  );

  if (isDashboardLoading) return <LoadingState />;
  if (!user) return <GuestState />;

  return (
    <div className="relative min-h-screen pb-28">
      <AmbientBackground />

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section
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
              <div
                className="p-[3px] rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--brand-500)), hsl(var(--wave-1)) 55%, hsl(var(--wave-2)))",
                }}
              >
                <Avatar className="size-32 sm:size-40 md:size-52 border-[3px] border-background shadow-floating">
                  <AvatarImage src={user?.avatar} alt={user?.fullName} />
                  <AvatarFallback
                    className="text-4xl sm:text-5xl font-black text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--brand-500)), hsl(var(--wave-2)))",
                    }}
                  >
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
                <p className="text-sm text-muted-foreground/70 font-medium">
                  <span>{tabCounts.likedTracks} bài đã thích</span>
                  <span className="mx-2 opacity-40">·</span>
                  <span>{tabCounts.playlists} playlist</span>
                  <span className="mx-2 opacity-40">·</span>
                  <span>{tabCounts.likedAlbums} album đã lưu</span>
                </p>
                {user?.bio && (
                  <p className="text-sm text-muted-foreground/55 italic max-w-md hidden md:block line-clamp-1">
                    {user.bio}
                  </p>
                )}
              </motion.div>
            </div>

            {/* Edit CTA */}
            <motion.div
              className="shrink-0 self-start md:self-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE_EXPO, delay: 0.15 }}
            >
              <button
                type="button"
                className="btn-secondary btn-lg gap-2 rounded-full"
              >
                <Edit className="size-4" aria-hidden="true" />
                Chỉnh sửa
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="section-container">
        <div className="divider-fade" />
      </div>

      {/* ══ TABS ════════════════════════════════════════════════════════════ */}
      <div className="section-container mt-0">
        <Tabs
          defaultValue="overview"
          className="w-full"
          onValueChange={setActiveTab}
        >
          {/* Tab rail */}
          <div className="sticky top-0 z-40 py-0 bg-background/90 backdrop-blur-2xl border-b border-border/30">
            <TabsList className="bg-transparent w-full justify-start rounded-none h-auto p-0 gap-0">
              {(
                [
                  { value: "overview", label: "Tổng quan", icon: BarChart3 },
                  { value: "playlists", label: "Playlist", icon: ListMusic },
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
                  key="overview"
                  variants={fadeUpVariants}
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
                        <div className="h-48 sm:h-60 p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={dashboard?.analytics}
                              margin={{
                                top: 4,
                                right: 4,
                                left: -22,
                                bottom: 0,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="profileChartGrad"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="hsl(var(--primary))"
                                    stopOpacity={0.28}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="hsl(var(--primary))"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 7"
                                vertical={false}
                                stroke="hsl(var(--border))"
                                opacity={0.4}
                              />
                              <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{
                                  fill: "hsl(var(--muted-foreground))",
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                                dy={8}
                              />
                              <Tooltip content={<ChartTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="count"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#profileChartGrad)"
                                dot={false}
                                activeDot={{
                                  r: 4,
                                  fill: "hsl(var(--primary))",
                                  stroke: "hsl(var(--background))",
                                  strokeWidth: 2,
                                }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
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
                      <RecentlyPlayedTrackList />
                    </section>
                  </div>

                  {/* Sidebar */}
                  <aside className="space-y-5" aria-label="Thông tin profile">
                    {/* Bio card */}
                    <div className="card-base p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-border/40 shrink-0">
                          <AvatarImage src={user?.avatar} />
                          <AvatarFallback
                            className="text-sm font-black text-white"
                            style={{
                              background:
                                "linear-gradient(135deg, hsl(var(--brand-500)), hsl(var(--wave-2)))",
                            }}
                          >
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
                        {[
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
                            icon: Disc,
                            label: "Album đã lưu",
                            value: tabCounts.likedAlbums,
                            color: "hsl(var(--success))",
                          },
                        ].map(({ icon: Icon, label, value, color }) => (
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
                        ))}
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
                  key="playlists"
                  variants={fadeVariants}
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
                    {!myPlaylists?.length ? (
                      <EmptyState
                        icon={ListMusic}
                        title="Chưa có playlist"
                        description="Tạo playlist đầu tiên để bắt đầu."
                      />
                    ) : (
                      myPlaylists?.map((p: IMyPlaylist, i: number) => (
                        <motion.div
                          key={p._id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.38,
                            ease: EASE_EXPO,
                            delay: Math.min(i * 45, 500),
                          }}
                        >
                          <PublicPlaylistCard playlist={p} />
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* ══ LIBRARY ═════════════════════════════════════════════ */}
              {activeTab === "library" && (
                <motion.div
                  key="library"
                  variants={fadeVariants}
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

                  <Tabs defaultValue="liked_tracks">
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
                      <FavouriteTrackList />
                    </TabsContent>

                    <TabsContent value="liked_albums" className="mt-0">
                      {!dashboard?.library?.albums?.length ? (
                        <EmptyState
                          icon={Disc}
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
                        <EmptyState
                          icon={ListMusic}
                          title="Chưa có playlist đã lưu"
                          description="Playlist bạn lưu sẽ xuất hiện ở đây."
                        />
                      ) : (
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
}
