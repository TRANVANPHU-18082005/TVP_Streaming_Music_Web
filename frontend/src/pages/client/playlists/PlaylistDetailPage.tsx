import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  memo,
  type FC,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  MoreHorizontal,
  Lock,
  Globe,
  PenSquare,
  ListMusic,
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

import { useAppSelector } from "@/store/hooks";
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
  usePlaylistMutations,
  usePlaylistDetail,
  TrackList,
  EditPlaylistTracksModal,
  PlaylistModal,
  PlaylistDetailSkeleton,
  IPlaylist,
  usePlaylistTracksInfinite,
  useSyncInteractions,
} from "@/features";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { PlaylistLikeButton } from "@/features/interaction/components/LikeButton";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import { formatDuration } from "@/utils/track-helper";
import { buildPalette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";

dayjs.extend(relativeTime);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaylistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

interface Palette {
  hex: string;
  r: (opacity: number) => string;
  heroGradient: string;
  hslChannels: string;
  glowShadow: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — synced with AlbumDetailPage
// ─────────────────────────────────────────────────────────────────────────────

const SP_GENTLE = { type: "spring", stiffness: 300, damping: 30 } as const;
const SP_SNAPPY = { type: "spring", stiffness: 440, damping: 28 } as const;
const SP_HERO = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — synced with AlbumDetailPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// useScrollY — synced with AlbumDetailPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// VisibilityBadge
// ─────────────────────────────────────────────────────────────────────────────

const VisibilityBadge = memo<{ visibility?: string }>(({ visibility }) => {
  if (visibility === "private") {
    return (
      <Badge
        variant="destructive"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 shrink-0"
      >
        <Lock className="size-2.5" aria-hidden="true" /> Riêng tư
      </Badge>
    );
  }
  if (visibility === "public") {
    return (
      <Badge
        variant="outline"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 border-border/40 shrink-0"
      >
        <Globe className="size-2.5" aria-hidden="true" /> Công khai
      </Badge>
    );
  }
  return null;
});
VisibilityBadge.displayName = "VisibilityBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistMeta
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistMeta = memo<{
  trackCount: number;
  durationSec: number;
  createdAt?: string;
  className?: string;
  compact?: boolean;
}>(({ trackCount, durationSec, createdAt, className, compact }) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-muted-foreground",
      compact ? "text-[11px]" : "text-[13px]",
      className,
    )}
  >
    <span className="font-bold text-foreground/80">{trackCount} bài hát</span>
    {durationSec > 0 && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>{formatDuration(durationSec)}</span>
      </>
    )}
    {createdAt && !compact && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>{dayjs(createdAt).fromNow()}</span>
      </>
    )}
  </div>
));
PlaylistMeta.displayName = "PlaylistMeta";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistCover — upgraded with glow halo + conic ring + EQ overlay (like HeroCover)
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistCoverProps {
  playlist: IPlaylist;
  palette: Palette;
  isOwner: boolean;
  isPlaying?: boolean;
  size: "sm" | "lg";
  onEditCover: () => void;
}

const PlaylistCover = memo<PlaylistCoverProps>(
  ({ playlist, palette, isOwner, isPlaying = false, size, onEditCover }) => {
    const isLg = size === "lg";
    const dim = isLg
      ? "size-[200px] sm:size-[240px] md:size-[290px]"
      : "size-[68px] sm:size-20";
    return (
      <div
        className={cn(
          "group relative shrink-0",
          isLg ? "self-center md:self-auto" : "",
        )}
      >
        {/* Glow halo — synced with HeroCover */}
        <div
          aria-hidden="true"
          className="absolute -inset-3 rounded-2xl blur-3xl pointer-events-none transition-opacity duration-700"
          style={{
            backgroundColor: palette.hex,
            opacity: isPlaying ? 0.48 : 0.2,
          }}
        />

        {/* Spinning conic ring — only lg + playing */}
        <AnimatePresence>
          {isPlaying && isLg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              aria-hidden="true"
              className="absolute -inset-[5px] rounded-2xl pointer-events-none"
              style={{
                background: `conic-gradient(
                  ${palette.r(0.9)} 0deg,
                  ${palette.r(0.1)} 120deg,
                  ${palette.r(0.7)} 240deg,
                  ${palette.r(0.9)} 360deg
                )`,
                animation: "album-ring-spin 4s linear infinite",
              }}
            />
          )}
        </AnimatePresence>

        {/* Cover shell */}
        <div
          className={cn(
            "relative rounded-2xl overflow-hidden border border-white/10 bg-muted",
            "transition-[transform,box-shadow] duration-500 group-hover:scale-[1.012]",
            dim,
          )}
          style={
            isPlaying && isLg
              ? {
                  boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
                }
              : { boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }
          }
        >
          {playlist.coverImage ? (
            <img
              src={playlist.coverImage}
              alt={playlist.title}
              className={cn(
                "size-full object-cover transition-[transform,filter] duration-700",
                isLg && "group-hover:scale-105",
                isPlaying && isLg && "saturate-[1.15] brightness-[0.88]",
              )}
              loading={isLg ? "eager" : "lazy"}
              fetchPriority={isLg ? "high" : "auto"}
              decoding="async"
            />
          ) : (
            <div
              className="size-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${palette.r(0.3)} 0%, ${palette.r(0.08)} 100%)`,
              }}
            >
              <ListMusic
                className={cn(
                  "text-muted-foreground/25",
                  isLg ? "size-14" : "size-6",
                )}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Now Playing overlay — EQ bars + gradient tint */}
          <AnimatePresence>
            {isPlaying && isLg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex flex-col items-center justify-end pb-5 gap-2"
                style={{
                  background: `linear-gradient(to top, ${palette.r(0.82)} 0%, ${palette.r(0.18)} 55%, transparent 100%)`,
                }}
                aria-hidden="true"
              >
                <div className="eq-bars h-7">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="eq-bar"
                      style={{ background: "rgba(255,255,255,0.88)" }}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-black text-white/72 uppercase tracking-[0.22em]">
                  Đang phát
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inner vignette */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-tr from-black/15 to-transparent pointer-events-none ring-1 ring-inset ring-black/10 rounded-[inherit]"
          />

          {/* Owner edit overlay (lg only) */}
          {isLg && isOwner && (
            <button
              type="button"
              onClick={onEditCover}
              aria-label="Edit cover image"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2",
                "bg-black/55 backdrop-blur-sm opacity-0 group-hover:opacity-100",
                "transition-opacity duration-250 cursor-pointer",
                "focus-visible:opacity-100 focus-visible:outline-none",
              )}
            >
              <PenSquare className="size-7 text-white" aria-hidden="true" />
              <span className="text-white text-[9px] font-black uppercase tracking-widest">
                Chỉnh sửa
              </span>
            </button>
          )}
        </div>
      </div>
    );
  },
);
PlaylistCover.displayName = "PlaylistCover";

// ─────────────────────────────────────────────────────────────────────────────
// ActionIconButton
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// TooltipAction
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistActionBar — upgraded with Pause state + AnimatePresence icons + glow ring
// Synced fully with AlbumDetailPage ActionBar
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistActionBarProps {
  playlistId: string;
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isPlaying: boolean;
  hasTracks: boolean;
  isOwner: boolean;
  density?: "compact" | "full";
  onPlay: () => void;
  onShuffle: () => void;
  onManageTracks: () => void;
}

const PlaylistActionBar = memo<PlaylistActionBarProps>(
  ({
    playlistId,
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isPlaying,
    hasTracks,
    isOwner,
    density = "full",
    onPlay,
    onShuffle,
    onManageTracks,
  }) => {
    const isCompact = density === "compact";
    const playSz = isCompact ? "size-12" : "size-14 sm:size-16";
    const playIconSz = isCompact ? "size-5" : "size-6 sm:size-7";
    const ctrlSz = isCompact ? "size-10" : "size-10 sm:size-11";
    const ctrlIconSz = isCompact ? "size-3.5" : "size-4";
    const canPlay = hasTracks && !isLoadingPlay;
    const canShuffle = hasTracks && !isLoadingShuffle;

    return (
      <div
        className="flex items-center gap-3"
        role="toolbar"
        aria-label="Playlist controls"
      >
        {/* ── PLAY / PAUSE — synced with AlbumDetailPage */}
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause playlist" : "Play playlist"}
          aria-pressed={isPlaying}
          className={cn(
            playSz,
            "rounded-full flex items-center justify-center shrink-0 shadow-lg",
            "transition-[box-shadow,transform] duration-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={{
            backgroundColor: palette.hex,
            boxShadow: isPlaying
              ? `${palette.glowShadow}, 0 0 0 5px ${palette.r(0.22)}`
              : palette.glowShadow,
          }}
          whileHover={canPlay ? { scale: 1.06 } : undefined}
          whileTap={canPlay ? { scale: 0.93 } : undefined}
          transition={SP_SNAPPY}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoadingPlay ? (
              <motion.span
                key="load"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2
                  className={cn(playIconSz, "text-white animate-spin")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : isPlaying ? (
              <motion.span
                key="pause"
                initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
                transition={SP_SNAPPY}
              >
                <Pause
                  className={cn(playIconSz, "text-white fill-white")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.6, opacity: 0, rotate: 15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: -15 }}
                transition={SP_SNAPPY}
              >
                <Play
                  className={cn(playIconSz, "text-white fill-white ml-0.5")}
                  aria-hidden="true"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* ── SHUFFLE */}
        <motion.button
          type="button"
          onClick={onShuffle}
          disabled={!canShuffle}
          aria-label="Shuffle playlist"
          className={cn(
            ctrlSz,
            "rounded-full flex items-center justify-center border border-border/50",
            "bg-background/30 backdrop-blur-sm text-foreground/70",
            "hover:text-foreground hover:bg-muted/60 hover:border-border",
            "transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
          whileTap={canShuffle ? { scale: 0.9 } : undefined}
          transition={SP_SNAPPY}
        >
          {isLoadingShuffle ? (
            <Loader2
              className={cn(ctrlIconSz, "animate-spin")}
              aria-hidden="true"
            />
          ) : (
            <Shuffle className={ctrlIconSz} aria-hidden="true" />
          )}
        </motion.button>

        <PlaylistLikeButton id={playlistId} variant="detail" />

        {/* Owner tools */}
        {isOwner && (
          <>
            <TooltipAction
              label="Add tracks"
              icon={<ListMusic className={ctrlIconSz} aria-hidden="true" />}
              onClick={onManageTracks}
            />
          </>
        )}

        <div className="flex-1" aria-hidden="true" />

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionIconButton
              className={isCompact ? "size-9" : "size-10 sm:size-11"}
              aria-label="More options"
            >
              <MoreHorizontal
                className={isCompact ? "size-4" : "size-[18px]"}
                aria-hidden="true"
              />
            </ActionIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
          >
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
              <PlusCircle className="size-4 shrink-0" aria-hidden="true" /> Thêm
              vào danh sách khác
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-primary focus:text-primary focus:bg-primary/10">
              <Share2 className="size-4 shrink-0" aria-hidden="true" /> Chia sẻ
              Playlist
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuSeparator className="bg-border/40 my-1" />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
PlaylistActionBar.displayName = "PlaylistActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// EmptyPlaylistState
// ─────────────────────────────────────────────────────────────────────────────

const EmptyPlaylistState = memo<{
  isOwner: boolean;
  onAdd: () => void;
  compact?: boolean;
}>(({ isOwner, onAdd, compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4 gap-4" : "py-20 px-6 gap-6",
    )}
    role="status"
    aria-label="Empty playlist"
  >
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-primary/15 blur-2xl rounded-full scale-150 pointer-events-none"
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
          aria-hidden="true"
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
        <PlusCircle className="size-4" aria-hidden="true" />
        Tìm bài hát
      </button>
    )}
  </div>
));
EmptyPlaylistState.displayName = "EmptyPlaylistState";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistNotFound
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistNotFound = memo<{ onBack: () => void; onRetry: () => void }>(
  ({ onBack, onRetry }) => (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-7 text-center px-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-destructive/15 blur-3xl rounded-full scale-150 pointer-events-none"
        />
        <div className="relative z-10 size-24 rounded-2xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
          <SearchX
            className="size-10 text-muted-foreground/60"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground">
          Không tìm thấy Playlist
        </h2>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
          Danh sách phát đã bị xóa, đặt về riêng tư, hoặc đường dẫn không hợp
          lệ.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border/60 text-sm font-bold text-foreground/80 hover:bg-muted/60 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" /> Thử lại
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Quay lại
        </button>
      </div>
    </div>
  ),
);
PlaylistNotFound.displayName = "PlaylistNotFound";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistModals
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistModals = memo<{
  playlist: IPlaylist;
  isEditMetaOpen: boolean;
  isManageTracksOpen: boolean;
  isDeleteOpen: boolean;
  isMutating: boolean;
  handleSubmitForm: (data: FormData) => Promise<void>;
  onCloseEditMeta: () => void;
  onCloseManageTracks: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}>(
  ({
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
        isPending={isMutating}
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
  ),
);
PlaylistModals.displayName = "PlaylistModals";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistDetailPage: FC<PlaylistDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();

  const isEmbedded = variant === "embedded";
  const { user } = useAppSelector((state) => state.auth);

  const scrollRef = useRef<HTMLDivElement>(null);
  // useScrollY: embedded = track scrollRef, page = track window
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 140 : 285);

  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [isManageTracksOpen, setIsManageTracksOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const {
    data: playlist,
    isLoading,
    isError,
    refetch,
  } = usePlaylistDetail(slug);

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = usePlaylistTracksInfinite(playlist?._id);

  const {
    togglePlayPlaylist,
    shufflePlaylist,
    isThisPlaylistPlaying,
    isThisPlaylistActive,
    isFetching,
  } = usePlaylistPlayback(playlist);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const totalItems = useMemo(
    () => playlist?.trackIds.length ?? tracksData?.totalItems ?? 0,
    [playlist?.trackIds.length, tracksData?.totalItems],
  );

  const playlistIds = useMemo(
    () => (playlist?._id ? [playlist._id] : []),
    [playlist?._id],
  );
  useSyncInteractions(playlistIds, "like", "playlist", !!playlist?._id);

  const syncEnabled = useMemo(
    () => !isLoadingTracks && !!playlist?._id,
    [isLoadingTracks, playlist?._id],
  );
  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", syncEnabled);

  // ── Palette — full system like AlbumDetailPage
  const palette = useMemo(
    () => buildPalette(playlist?.themeColor ?? "#8b5cf6"),
    [playlist?.themeColor],
  );

  const totalDurationSec = useMemo(
    () =>
      playlist?.totalDuration != null
        ? playlist.totalDuration
        : allTracks.reduce((s, t) => s + (t.duration ?? 0), 0),
    [playlist?.totalDuration, allTracks],
  );

  const { className: titleCls, style: titleStyle } = useTitleStyle(
    playlist?.title ?? "",
  );
  const { updatePlaylistAsync, deletePlaylist, isMutating } =
    usePlaylistMutations();

  const isOwner = useMemo(
    () => playlist?.user?._id === user?._id || user?.role === "admin",
    [playlist?.user?._id, user?._id, user?.role],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (isEmbedded && onClose) onClose();
    else navigate(-1);
  }, [isEmbedded, onClose, navigate]);

  const handleSubmitForm = useCallback(
    async (formData: FormData) => {
      if (!playlist) return;
      try {
        await updatePlaylistAsync(playlist._id, formData);
        setIsEditMetaOpen(false);
      } catch {
        // Keep modal open for user to fix
      }
    },
    [playlist, updatePlaylistAsync],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!playlist) return;
    deletePlaylist(playlist._id);
    setIsDeleteOpen(false);
    if (isEmbedded && onClose) onClose();
    else navigate("/playlists");
  }, [playlist, deletePlaylist, isEmbedded, onClose, navigate]);

  // ── Shared props ──────────────────────────────────────────────────────────

  const sharedActionBarProps: PlaylistActionBarProps = useMemo(
    () => ({
      playlistId: playlist?._id || "",
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisPlaylistPlaying,
      hasTracks: totalItems > 0,
      isOwner,
      onPlay: togglePlayPlaylist,
      onShuffle: shufflePlaylist,
      onManageTracks: () => setIsManageTracksOpen(true),
    }),
    [
      playlist?._id,
      palette,
      isFetching,
      isThisPlaylistPlaying,
      totalItems,
      isOwner,
      togglePlayPlaylist,
      shufflePlaylist,
    ],
  );

  const trackListProps = useMemo(
    () => ({
      allTrackIds: playlist?.trackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetchTracks,
    }),
    [
      playlist?.trackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetchTracks,
    ],
  );

  // ── Render guards ─────────────────────────────────────────────────────────

  if (isLoading) return <PlaylistDetailSkeleton variant={variant} />;

  if (isError || !playlist) {
    return (
      <PlaylistNotFound
        onBack={() =>
          isEmbedded && onClose ? onClose() : navigate("/playlists")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ── Shared modal props
  const modalProps = {
    playlist,
    isEditMetaOpen,
    isManageTracksOpen,
    isDeleteOpen,
    isMutating,
    handleSubmitForm,
    onCloseEditMeta: () => setIsEditMetaOpen(false),
    onCloseManageTracks: () => setIsManageTracksOpen(false),
    onCloseDelete: () => setIsDeleteOpen(false),
    onConfirmDelete: handleConfirmDelete,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDED VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  if (isEmbedded) {
    return (
      <>
        <div
          ref={scrollRef}
          className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
          role="region"
          aria-label={`Playlist: ${playlist.title}`}
        >
          <div
            aria-hidden="true"
            className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
            style={{ background: palette.heroGradient }}
          />

          <div className="relative z-10 -mt-[160px] px-4 pb-10">
            {onClose && (
              <div className="pt-4 pb-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" /> Đóng
                </button>
              </div>
            )}

            <motion.div
              className="flex items-center gap-3.5 pt-3 pb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SP_GENTLE}
            >
              <PlaylistCover
                playlist={playlist}
                palette={palette}
                isOwner={isOwner}
                size="sm"
                onEditCover={() => setIsEditMetaOpen(true)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {playlist.isSystem ? "Hệ thống" : "Playlist"}
                  </span>
                  <VisibilityBadge visibility={playlist.visibility} />
                </div>
                <h2 className="text-xl font-black tracking-tight leading-tight line-clamp-2 text-foreground">
                  {playlist.title}
                </h2>
                <PlaylistMeta
                  trackCount={totalItems}
                  durationSec={totalDurationSec}
                  createdAt={playlist.createdAt}
                  className="mt-1"
                  compact
                />
                {/* Playing indicator in embedded — synced with AlbumDetailPage */}
                <AnimatePresence>
                  {isThisPlaylistPlaying && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center gap-1.5 mt-1.5"
                    >
                      <div className="eq-bars h-3">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="eq-bar"
                            style={{ background: palette.hex }}
                          />
                        ))}
                      </div>
                      <span
                        className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: palette.hex }}
                      >
                        Đang phát
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <div className="mb-5">
              <PlaylistActionBar {...sharedActionBarProps} density="full" />
            </div>

            {playlist.description && (
              <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-4 line-clamp-3">
                {playlist.description}
              </p>
            )}

            <TrackList
              {...trackListProps}
              maxHeight={400}
              moodColor={palette.hslChannels}
              skeletonCount={7}
              staggerAnimation={false}
            />
          </div>
        </div>

        <PlaylistModals {...modalProps} />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      {/* Background layers — synced with AlbumDetailPage */}
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Back button */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold transition-all duration-200 text-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Quay lại
          </button>
        </div>

        {/* Hero section — motion stagger like AlbumDetailPage */}
        <motion.section
          aria-label="Playlist details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SP_HERO, delay: 0.08 }}
          >
            <PlaylistCover
              playlist={playlist}
              palette={palette}
              isOwner={isOwner}
              isPlaying={isThisPlaylistPlaying}
              size="lg"
              onEditCover={() => setIsEditMetaOpen(true)}
            />
          </motion.div>

          {/* Meta */}
          <motion.div
            className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_HERO, delay: 0.14 }}
          >
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
                {playlist.isSystem ? (
                  <>
                    <Sparkles className="size-3" aria-hidden="true" /> Hệ thống
                  </>
                ) : (
                  <>
                    <Users className="size-3" aria-hidden="true" /> Cộng đồng
                  </>
                )}
              </div>
              <VisibilityBadge visibility={playlist.visibility} />
            </div>

            {/* Title */}
            <div className="overflow-visible min-w-0 w-full">
              <h1
                className={cn(
                  "font-black tracking-tighter text-foreground drop-shadow-lg w-full",
                  "text-center md:text-left",
                  titleCls,
                )}
                style={titleStyle}
              >
                {playlist.title}
              </h1>
            </div>

            {/* Description */}
            {playlist.description ? (
              <p className="text-sm md:text-[15px] text-muted-foreground font-medium line-clamp-2 max-w-xl mt-0.5 text-center md:text-left">
                {playlist.description}
              </p>
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditMetaOpen(true)}
                className="text-sm text-muted-foreground/45 italic hover:text-primary transition-colors flex items-center gap-1.5 mt-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <PenSquare className="size-3.5" aria-hidden="true" /> Thêm mô tả
                cho danh sách phát…
              </button>
            ) : null}

            {/* Owner + meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => navigate(`/profile/${playlist.user?._id}`)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity group/user focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                aria-label={`View profile: ${playlist.user?.fullName ?? "System"}`}
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
              <span
                className="text-foreground/30 text-xs hidden sm:inline"
                aria-hidden="true"
              >
                •
              </span>
              <PlaylistMeta
                trackCount={totalItems}
                durationSec={totalDurationSec}
                createdAt={playlist.createdAt}
              />
            </div>

            {/* Playing status pill — synced with AlbumDetailPage */}
            <AnimatePresence>
              {isThisPlaylistActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: 4 }}
                  transition={SP_SNAPPY}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
                  style={{
                    background: palette.r(0.1),
                    borderColor: palette.r(0.28),
                  }}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "eq-bars shrink-0 flex items-end gap-[2px] h-4",
                      !isThisPlaylistPlaying && "paused opacity-40",
                      "transition-opacity duration-300",
                    )}
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="eq-bar w-[3px] rounded-full sw-animate-eq"
                        style={{
                          animationDelay: `${i * 0.12}s`,
                          backgroundColor: palette.hex,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: palette.hex }}
                  >
                    {isThisPlaylistPlaying ? "Đang phát" : "Đã tạm dừng"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* Sticky action bar — synced with AlbumDetailPage */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex items-center justify-between gap-4",
            "transition-[background,box-shadow,border-color] duration-300",
            "top-[var(--navbar-height,64px)]",
            "shadow-brand-dynamic",

            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
          style={
            {
              animationDelay: "80ms",
              // Nếu không có moodColor thì fallback về màu primary mặc định
              "--local-shadow-color": palette.hslChannels || "var(--primary)",
            } as React.CSSProperties
          }
        >
          <PlaylistActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled playlist identity — with playing state */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                className="flex items-center gap-2.5 pointer-events-none select-none shrink-0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={SP_GENTLE}
                aria-hidden="true"
              >
                {/* Mini EQ when playing */}
                <AnimatePresence>
                  {isThisPlaylistPlaying && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "eq-bars shrink-0 flex items-end gap-[2px] h-4",
                        !isThisPlaylistPlaying && "paused opacity-40",
                        "transition-opacity duration-300",
                      )}
                    >
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className="eq-bar w-[3px] rounded-full sw-animate-eq"
                          style={{
                            animationDelay: `${i * 0.12}s`,
                            backgroundColor: palette.hex,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
                  {playlist.title}
                </span>

                {/* Cover thumbnail — ring when playing */}
                <div
                  className={cn(
                    "size-9 sm:size-10 rounded-lg overflow-hidden shrink-0 border bg-muted flex items-center justify-center transition-all duration-300",
                    isThisPlaylistPlaying
                      ? "border-transparent"
                      : "border-border/30",
                  )}
                  style={
                    isThisPlaylistPlaying
                      ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` }
                      : undefined
                  }
                >
                  {playlist.coverImage ? (
                    <img
                      src={playlist.coverImage}
                      alt=""
                      aria-hidden="true"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ListMusic
                      className="size-4 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Track list */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SP_GENTLE, delay: 0.22 }}
        >
          <TrackList
            {...trackListProps}
            maxHeight="auto"
            skeletonCount={12}
            moodColor={palette.hslChannels}
            staggerAnimation={true}
          />
        </motion.div>

        {/* Footer */}
        {totalItems > 0 && (
          <footer className="mt-16 pt-7 border-t border-border/25 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground/60 font-medium pb-8">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 opacity-50" aria-hidden="true" />
              Tạo ngày {dayjs(playlist.createdAt).format("DD/MM/YYYY")}
            </span>
            <span
              className="text-muted-foreground/30 hidden sm:inline"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="font-bold text-foreground/60">
              {totalItems} bài hát
            </span>
            {totalDurationSec > 0 && (
              <>
                <span
                  className="text-muted-foreground/30 hidden sm:inline"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span>{formatDuration(totalDurationSec)}</span>
              </>
            )}
          </footer>
        )}
      </div>

      <PlaylistModals {...modalProps} />
    </main>
  );
};

export default PlaylistDetailPage;
