import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
  Heart,
  MoreHorizontal,
  Lock,
  Globe,
  PenSquare,
  ListMusic,
  Trash2,
  PlusCircle,
  Share2,
  Music2,
  SearchX,
  Loader2,
  ChevronLeft,
  Shuffle,
  Clock,
  RefreshCw,
  Users,
  Sparkles,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";

// Hooks & Store
import { useAppDispatch, useAppSelector } from "@/store/hooks";

// UI Components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import ConfirmationModal from "@/components/ui/ConfirmationModal";
import {
  ITrack,
  Playlist,
  setIsPlaying,
  setQueue,
  usePlaylistMutations,
  useSyncInteractions,
  usePlaylistDetail,
  TrackList,
  EditPlaylistTracksModal,
  PlaylistModal,
  PlaylistDetailSkeleton,
} from "@/features";

dayjs.extend(relativeTime);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${opacity})`
    : `rgba(139,92,246,${opacity})`;
};

const playlistTitleSizeClass = (title: string): string => {
  const len = title.length;
  if (len > 38) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 20) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  return "text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] xl:text-[7rem]";
};

const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PlaylistDetailPageProps {
  /**
   * page     – Full standalone page with hero, sticky bar, gradient backdrop (default)
   * embedded – Compact scrollable panel for drawer / modal / side panel
   */
  variant?: "page" | "embedded";
  /** Override slug (for embedded). Falls back to useParams. */
  slugOverride?: string;
  /** Called when closing in embedded mode */
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const PlaylistDetailPage: React.FC<PlaylistDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── UI state
  const [scrollY, setScrollY] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);

  // ── Modal state
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [isManageTracksOpen, setIsManageTracksOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isScrolled = variant === "page" ? scrollY > 285 : scrollY > 140;

  // ── Data
  const {
    data: playlist,
    isLoading,
    isError,
    refetch,
  } = usePlaylistDetail(slug);
  const trackIds = useMemo(
    () => playlist?.tracks?.map((t: ITrack) => t._id) || [],
    [playlist],
  );
  // ── 3. 🚀 ĐỒNG BỘ TRẠNG THÁI LIKE (TỰ ĐỘNG)
  useSyncInteractions(trackIds, "like", !isLoading);
  const tracks = useMemo(() => playlist?.tracks ?? [], [playlist]);
  const themeColor = useMemo(
    () => playlist?.themeColor ?? "#8b5cf6",
    [playlist],
  );
  const {
    createPlaylistAsync,
    updatePlaylistAsync,
    deletePlaylist,
    isMutating, // Loading cho Save/Delete
  } = usePlaylistMutations();
  const isOwner = useMemo(
    () => playlist?.user?._id === user?._id || user?.role === "admin",
    [playlist, user],
  );

  const totalDurationSec = useMemo(
    () => tracks.reduce((acc: number, t: ITrack) => acc + (t.duration ?? 0), 0),
    [tracks],
  );
  const handleSubmitForm = async (formData: FormData) => {
    try {
      if (playlist) {
        await updatePlaylistAsync(playlist._id, formData);
      } else {
        await createPlaylistAsync(formData);
      }
      setIsManageTracksOpen(false);
    } catch (error) {
      console.error("Failed to save playlist", error);
      // Giữ modal mở để user sửa lỗi
    }
  };
  const handleConfirmDelete = () => {
    if (playlist) {
      deletePlaylist(playlist._id);
    }
  };
  // ── Scroll tracking — window vs embedded container
  useEffect(() => {
    if (variant === "embedded") {
      const el = scrollContainerRef.current;
      if (!el) return;
      const handler = () => setScrollY(el.scrollTop);
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    }
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [variant]);

  // ── Play dispatch helper
  const dispatchPlay = useCallback(
    (shuffled = false) => {
      const list = shuffled
        ? [...tracks].sort(() => Math.random() - 0.5)
        : tracks;
      dispatch(setQueue({ tracks: list, startIndex: 0 }));
      dispatch(setIsPlaying(true));
    },
    [tracks, dispatch],
  );

  const handlePlayPlaylist = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Danh sách phát này chưa có bài hát nào.");
      return;
    }
    setIsLoadingPlay(true);
    try {
      dispatchPlay(false);
      toast.success(`Đang phát ${tracks.length} bài hát`, { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingPlay(false);
    }
  }, [tracks, dispatchPlay]);

  const handleShuffle = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Danh sách phát này chưa có bài hát nào.");
      return;
    }
    setIsLoadingShuffle(true);
    try {
      dispatchPlay(true);
      toast.success("Phát ngẫu nhiên", { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingShuffle(false);
    }
  }, [tracks, dispatchPlay]);

  const handleBack = useCallback(() => {
    if (variant === "embedded" && onClose) onClose();
    else navigate(-1);
  }, [variant, onClose, navigate]);

  // ─────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────
  if (isLoading) return <PlaylistDetailSkeleton />;
  if (isError || !playlist) {
    return (
      <PlaylistNotFound
        onBack={() =>
          variant === "embedded" && onClose ? onClose() : navigate("/playlists")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ── Shared: Visibility badge
  const VisibilityBadge =
    playlist.visibility === "private" ? (
      <Badge
        variant="destructive"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 shrink-0"
      >
        <Lock className="size-2.5" /> Riêng tư
      </Badge>
    ) : playlist.visibility === "public" ? (
      <Badge
        variant="outline"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 border-border/40 shrink-0"
      >
        <Globe className="size-2.5" /> Công khai
      </Badge>
    ) : null;

  // ── Shared: Action buttons row
  const ActionButtons = (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {/* Play */}
      <button
        type="button"
        onClick={handlePlayPlaylist}
        disabled={isLoadingPlay}
        aria-label="Phát playlist"
        className={cn(
          "rounded-full flex items-center justify-center shrink-0",
          variant === "embedded" ? "size-11" : "size-14 sm:size-16",
          "transition-all duration-200 hover:scale-105 active:scale-90",
          "shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
        style={{
          backgroundColor: themeColor,
          boxShadow: `0 8px 28px -6px ${hexToRgba(themeColor, 0.55)}`,
        }}
      >
        {isLoadingPlay ? (
          <Loader2 className="size-6 text-white animate-spin" />
        ) : (
          <Play className="size-6 text-white fill-white ml-0.5" />
        )}
      </button>

      {/* Shuffle */}
      <ActionIconButton
        onClick={handleShuffle}
        disabled={isLoadingShuffle || !tracks.length}
        aria-label="Phát ngẫu nhiên"
      >
        {isLoadingShuffle ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Shuffle className="size-4" />
        )}
      </ActionIconButton>

      {/* Save / Heart */}
      <ActionIconButton
        onClick={() => setIsSaved((s) => !s)}
        aria-label={isSaved ? "Đã lưu" : "Lưu playlist"}
        className={cn(
          isSaved &&
            "border-emerald-500/25 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15",
        )}
      >
        <Heart
          className={cn(
            "size-4 transition-all duration-300",
            isSaved && "fill-emerald-500 scale-110",
          )}
        />
      </ActionIconButton>

      {/* Owner tools */}
      {isOwner && (
        <>
          <TooltipAction
            label="Thêm bài hát"
            icon={<ListMusic className="size-4" />}
            onClick={() => setIsManageTracksOpen(true)}
          />
          <TooltipAction
            label="Sửa thông tin"
            icon={<PenSquare className="size-4" />}
            onClick={() => setIsEditMetaOpen(true)}
          />
        </>
      )}

      {/* More */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionIconButton aria-label="Thêm tùy chọn">
            <MoreHorizontal className="size-4" />
          </ActionIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
        >
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <PlusCircle className="size-4 shrink-0" /> Thêm vào danh sách khác
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-primary focus:text-primary focus:bg-primary/10">
            <Share2 className="size-4 shrink-0" /> Chia sẻ Playlist
          </DropdownMenuItem>
          {isOwner && (
            <>
              <DropdownMenuSeparator className="bg-border/40 my-1" />
              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-bold text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="size-4 shrink-0" /> Xóa Playlist
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── Shared: cover image / fallback
  const CoverImage = (size: "sm" | "lg") => {
    const dim =
      size === "lg"
        ? "size-[200px] sm:size-[240px] md:size-[290px]"
        : "size-[68px] sm:size-20";
    const radius = size === "lg" ? "rounded-2xl" : "rounded-xl";
    return (
      <div
        className={cn(
          "relative overflow-hidden border border-border/15 bg-muted",
          "shadow-[0_16px_40px_rgba(0,0,0,0.38)] transition-transform duration-500 group-hover:scale-[1.02]",
          dim,
          radius,
        )}
      >
        {playlist.coverImage ? (
          <img
            src={playlist.coverImage}
            alt={playlist.title}
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(themeColor, 0.3)} 0%, ${hexToRgba(themeColor, 0.08)} 100%)`,
            }}
          >
            <ListMusic
              className={cn(
                "text-muted-foreground/25",
                size === "lg" ? "size-14" : "size-6",
              )}
            />
          </div>
        )}
        {/* Inner vignette */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-tr from-black/15 to-transparent pointer-events-none ring-1 ring-inset ring-black/10 rounded-[inherit]"
        />
        {/* Owner edit overlay (lg only) */}
        {size === "lg" && isOwner && (
          <button
            type="button"
            onClick={() => setIsEditMetaOpen(true)}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2",
              "bg-black/55 backdrop-blur-sm opacity-0 group-hover:opacity-100",
              "transition-opacity duration-250 cursor-pointer",
            )}
          >
            <PenSquare className="size-7 text-white" />
            <span className="text-white text-[9px] font-black uppercase tracking-widest">
              Chỉnh sửa
            </span>
          </button>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // EMBEDDED variant
  // ─────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <>
        <div
          ref={scrollContainerRef}
          className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground custom-scrollbar"
        >
          {/* Gradient cap */}
          <div
            aria-hidden
            className="sticky top-0 h-[160px] -mt-0 shrink-0 pointer-events-none z-0"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.38)} 0%, transparent 100%)`,
            }}
          />

          <div className="relative z-10 -mt-[160px] px-4 pb-10">
            {/* Close */}
            {onClose && (
              <div className="flex items-center pt-4 pb-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="size-4" />
                  Đóng
                </button>
              </div>
            )}

            {/* Compact hero */}
            <div className="flex items-center gap-3.5 pt-3 pb-5">
              <div className="relative group shrink-0">{CoverImage("sm")}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {playlist.isSystem ? "Hệ thống" : "Playlist"}
                  </span>
                  {VisibilityBadge}
                </div>
                <h2 className="text-xl font-black tracking-tight leading-tight line-clamp-2 text-foreground">
                  {playlist.title}
                </h2>
                <PlaylistMeta
                  trackCount={tracks.length}
                  durationSec={totalDurationSec}
                  createdAt={playlist.createdAt}
                  className="mt-1"
                  compact
                />
              </div>
            </div>

            {/* Actions */}
            {ActionButtons}

            {/* Description */}
            {playlist.description && (
              <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-4 line-clamp-3">
                {playlist.description}
              </p>
            )}

            {/* Tracklist */}
            <div className="mt-6 rounded-xl overflow-hidden border border-border/30 bg-card/40">
              {tracks.length > 0 ? (
                <TrackList tracks={tracks} isLoading={false} />
              ) : (
                <EmptyPlaylistState
                  isOwner={isOwner}
                  compact
                  onAdd={() => setIsManageTracksOpen(true)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modals — outside scroll container */}
        <PlaylistModals
          playlist={playlist}
          isEditMetaOpen={isEditMetaOpen}
          isManageTracksOpen={isManageTracksOpen}
          isDeleteOpen={isDeleteOpen}
          handleSubmitForm={handleSubmitForm}
          isMutating={isMutating}
          onCloseEditMeta={() => setIsEditMetaOpen(false)}
          onCloseManageTracks={() => setIsManageTracksOpen(false)}
          onCloseDelete={() => setIsDeleteOpen(false)}
          onConfirmDelete={() => {
            handleConfirmDelete();
          }}
        />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PAGE variant — full standalone
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* ── Backdrop gradient */}
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
        style={{
          background: `linear-gradient(180deg,
            ${hexToRgba(themeColor, 0.62)} 0%,
            ${hexToRgba(themeColor, 0.18)} 50%,
            transparent 100%)`,
        }}
      />
      {/* Noise texture layer */}
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Back nav */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/30"
          >
            <ChevronLeft className="size-4" />
            Quay lại
          </button>
        </div>

        {/* ── Hero */}
        <header className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10">
          {/* Cover art */}
          <div className="group relative shrink-0">
            <div
              aria-hidden
              className="absolute -inset-3 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
              style={{ backgroundColor: themeColor }}
            />
            {CoverImage("lg")}
          </div>

          {/* Info */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1">
            {/* Type + visibility badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
                {playlist.isSystem ? (
                  <>
                    <Sparkles className="size-3" /> Hệ thống
                  </>
                ) : (
                  <>
                    <Users className="size-3" /> Cộng đồng
                  </>
                )}
              </div>
              {VisibilityBadge}
            </div>

            <h1
              className={cn(
                "font-black tracking-tighter leading-[1.02] drop-shadow-xl text-foreground w-full",
                playlistTitleSizeClass(playlist.title),
                isOwner && "cursor-pointer hover:opacity-80 transition-opacity",
              )}
              onClick={() => isOwner && setIsEditMetaOpen(true)}
              title={isOwner ? "Nhấn để đổi tên" : undefined}
            >
              {playlist.title}
            </h1>

            {playlist.description ? (
              <p className="text-sm md:text-[15px] text-muted-foreground font-medium line-clamp-2 max-w-xl mt-0.5">
                {playlist.description}
              </p>
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditMetaOpen(true)}
                className="text-sm text-muted-foreground/45 italic hover:text-primary transition-colors flex items-center gap-1.5 mt-0.5"
              >
                <PenSquare className="size-3.5" /> Thêm mô tả cho danh sách
                phát…
              </button>
            ) : null}

            {/* Creator + stats */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => navigate(`/profile/${playlist.user?._id}`)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity group/user"
              >
                <Avatar className="size-6 border-[1.5px] border-background/70 shadow-sm">
                  <AvatarImage src={playlist.user?.avatar} />
                  <AvatarFallback className="text-[9px] font-black bg-primary/20 text-primary">
                    {playlist.user?.fullName?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-black text-foreground group-hover/user:underline underline-offset-3 decoration-2">
                  {playlist.user?.fullName ?? "Hệ thống"}
                </span>
              </button>

              <span className="text-foreground/30 text-xs hidden sm:inline">
                •
              </span>
              <PlaylistMeta
                trackCount={tracks.length}
                durationSec={totalDurationSec}
                createdAt={playlist.createdAt}
              />
            </div>
          </div>
        </header>

        {/* ── Sticky Action Bar */}
        <div
          className={cn(
            "sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex items-center justify-between gap-4 transition-all duration-300",
            "top-[var(--navbar-height,64px)]",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
        >
          {ActionButtons}

          {/* Mini info — fades in on scroll */}
          <div
            className={cn(
              "flex items-center gap-2.5 pointer-events-none select-none transition-all duration-400",
              isScrolled
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-3",
            )}
          >
            <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[220px] hidden sm:block">
              {playlist.title}
            </span>
            <div className="size-9 sm:size-10 rounded-xl overflow-hidden shadow-sm border border-border/30 shrink-0 bg-muted flex items-center justify-center">
              {playlist.coverImage ? (
                <img
                  src={playlist.coverImage}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ListMusic className="size-4 text-muted-foreground/40" />
              )}
            </div>
          </div>
        </div>

        {/* ── Tracklist */}
        <div className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm -mx-1 sm:mx-0">
          {tracks.length > 0 ? (
            <TrackList tracks={tracks} isLoading={false} />
          ) : (
            <EmptyPlaylistState
              isOwner={isOwner}
              onAdd={() => setIsManageTracksOpen(true)}
            />
          )}
        </div>

        {/* ── Footer */}
        {tracks.length > 0 && (
          <footer className="mt-16 pt-7 border-t border-border/25 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground/60 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 opacity-50" />
              Tạo ngày {dayjs(playlist.createdAt).format("DD/MM/YYYY")}
            </span>
            <span className="text-muted-foreground/30 hidden sm:inline">·</span>
            <span className="font-bold text-foreground/60">
              {tracks.length} bài hát
            </span>
            {totalDurationSec > 0 && (
              <>
                <span className="text-muted-foreground/30 hidden sm:inline">
                  ·
                </span>
                <span>{formatDuration(totalDurationSec)}</span>
              </>
            )}
          </footer>
        )}
      </div>

      {/* ── Modals */}
      <PlaylistModals
        playlist={playlist}
        isEditMetaOpen={isEditMetaOpen}
        isManageTracksOpen={isManageTracksOpen}
        isDeleteOpen={isDeleteOpen}
        handleSubmitForm={handleSubmitForm}
        isMutating={isMutating}
        onCloseEditMeta={() => setIsEditMetaOpen(false)}
        onCloseManageTracks={() => setIsManageTracksOpen(false)}
        onCloseDelete={() => setIsDeleteOpen(false)}
        onConfirmDelete={() => {
          setIsDeleteOpen(false);
          navigate("/playlists");
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Generic icon action button with forwardRef for DropdownMenuTrigger asChild */
const ActionIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "size-10 sm:size-11 rounded-full flex items-center justify-center",
      "border border-border/50 bg-background/25 backdrop-blur-sm",
      "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
      "transition-all duration-150 active:scale-90",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
ActionIconButton.displayName = "ActionIconButton";

/** Tooltip-wrapped owner action button */
const TooltipAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <TooltipProvider>
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <ActionIconButton onClick={onClick} aria-label={label}>
          {icon}
        </ActionIconButton>
      </TooltipTrigger>
      <TooltipContent className="font-bold text-[10px] uppercase tracking-widest bg-foreground text-background border-none shadow-xl px-3 py-1.5 rounded-full">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** Playlist meta (track count, duration, date) */
const PlaylistMeta: React.FC<{
  trackCount: number;
  durationSec: number;
  createdAt?: string;
  className?: string;
  compact?: boolean;
}> = ({ trackCount, durationSec, createdAt, className, compact }) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-2 gap-y-0.5",
      compact ? "text-[11px]" : "text-[13px]",
      "font-medium text-muted-foreground",
      className,
    )}
  >
    <span className="font-bold text-foreground/80">{trackCount} bài hát</span>
    {durationSec > 0 && (
      <>
        <span className="opacity-40 hidden sm:inline">·</span>
        <span>{formatDuration(durationSec)}</span>
      </>
    )}
    {createdAt && !compact && (
      <>
        <span className="opacity-40 hidden sm:inline">·</span>
        <span>{dayjs(createdAt).fromNow()}</span>
      </>
    )}
  </div>
);

/** Empty playlist state */
const EmptyPlaylistState: React.FC<{
  isOwner: boolean;
  onAdd: () => void;
  compact?: boolean;
}> = ({ isOwner, onAdd, compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4 gap-4" : "py-20 px-6 gap-6",
    )}
  >
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-primary/15 blur-[60px] rounded-full scale-150 pointer-events-none"
      />
      <div
        className={cn(
          "relative rounded-full bg-card border-2 border-dashed border-border/50 flex items-center justify-center shadow-sm",
          compact ? "size-16" : "size-28",
        )}
      >
        <Music2
          className={cn(
            "text-muted-foreground/30",
            compact ? "size-6" : "size-11",
          )}
        />
      </div>
    </div>
    <div className="space-y-1.5 max-w-xs">
      <h3
        className={cn(
          "font-black tracking-tight text-foreground",
          compact ? "text-base" : "text-xl",
        )}
      >
        Ở đây hơi vắng lặng
      </h3>
      <p
        className={cn(
          "text-muted-foreground font-medium leading-relaxed",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {isOwner
          ? "Thêm bài hát để xây dựng bộ sưu tập giai điệu riêng của bạn."
          : "Danh sách phát này chưa có bài hát nào."}
      </p>
    </div>
    {isOwner && (
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest",
          "bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-md",
          compact ? "h-9 px-5 text-[10px]" : "h-11 px-8 text-[11px] mt-1",
        )}
      >
        <PlusCircle className="size-4" />
        Tìm bài hát
      </button>
    )}
  </div>
);

/** Centralized modal rendering to avoid duplication between modes */
const PlaylistModals: React.FC<{
  playlist: Playlist;
  isEditMetaOpen: boolean;
  isManageTracksOpen: boolean;
  isDeleteOpen: boolean;
  isMutating: boolean;
  handleSubmitForm: (data: FormData) => Promise<void>;
  onCloseEditMeta: () => void;
  onCloseManageTracks: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}> = ({
  playlist,
  isEditMetaOpen,
  isManageTracksOpen,
  isDeleteOpen,
  isMutating,
  handleSubmitForm,
  onCloseEditMeta,
  onCloseManageTracks,
  onCloseDelete,
  onConfirmDelete,
}) => (
  <>
    <PlaylistModal
      isOpen={isEditMetaOpen}
      onClose={onCloseEditMeta}
      playlistToEdit={playlist}
      onSubmit={handleSubmitForm}
      isPending={isMutating} // Loading spinner cho nút Save
    />
    <EditPlaylistTracksModal
      isOpen={isManageTracksOpen}
      onClose={onCloseManageTracks}
      playlistId={playlist?._id}
    />
    <ConfirmationModal
      isOpen={isDeleteOpen}
      onCancel={onCloseDelete}
      onConfirm={onConfirmDelete}
      title="Xóa danh sách phát?"
      description={`Hành động này không thể hoàn tác. "${playlist?.title}" sẽ bị xóa vĩnh viễn.`}
      confirmLabel="Xóa vĩnh viễn"
      isDestructive
    />
  </>
);

/** Not found state */
const PlaylistNotFound: React.FC<{
  onBack: () => void;
  onRetry: () => void;
}> = ({ onBack, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in fade-in zoom-in-95 duration-500">
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-destructive/10 blur-[80px] rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-3xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <SearchX className="size-10 text-muted-foreground/50" />
      </div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground uppercase">
        Không tìm thấy Playlist
      </h2>
      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
        Danh sách phát đã bị xóa, đặt về riêng tư, hoặc đường dẫn không hợp lệ.
      </p>
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border/60 text-sm font-bold text-foreground/80 hover:bg-muted/60 transition-all active:scale-95"
      >
        <RefreshCw className="size-3.5" />
        Thử lại
      </button>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-95"
      >
        <ChevronLeft className="size-4" />
        Quay lại thư viện
      </button>
    </div>
  </div>
);

export default PlaylistDetailPage;
