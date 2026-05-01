import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
  type PanInfo,
} from "framer-motion";
import {
  Play,
  Shuffle,
  ListMusic,
  ListPlus,
  Share2,
  Download,
  Edit3,
  Trash2,
  Globe,
  Lock,
  UserPlus,
  UserCheck,
  Disc3,
  SkipForward,
  Music2,
  Mic2,
  Pause,
  Heart,
  Sparkles,
  Loader2,
  Search,
  Check,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IAlbum } from "@/features/album/types";
import { IMyPlaylist, IPlaylist } from "@/features/playlist/types";
import { useAppSelector } from "@/store/hooks";
import {
  IArtist,
  IGenre,
  ITrack,
  useInteraction,
  useMyPlaylists,
  usePlaylistMutations,
} from "@/features";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useIsLiked } from "@/features/interaction/hooks/useIsLiked";
import MusicResult from "@/components/ui/Result";
import QueuePanel from "@/features/player/components/Queuepanel";
import { toCDN } from "@/utils/track-helper";

// Helper types to avoid `any` casts in sheet context
// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS (giống với OptionSheet / AddToPlaylistSheet)
// ─────────────────────────────────────────────────────────────────────────────

const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  pop: { type: "spring", stiffness: 520, damping: 24 } as const,
  sheet: { type: "spring", stiffness: 300, damping: 28, mass: 0.65 } as const,
  item: { type: "spring", stiffness: 380, damping: 30 } as const,
} as const;

const SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: SHEET BACKDROP
// ─────────────────────────────────────────────────────────────────────────────

const SheetBackdrop = memo(
  ({ onClick, zIndex = 90 }: { onClick: () => void; zIndex?: number }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-[3px]"
      style={{ zIndex }}
      onClick={onClick}
      aria-hidden="true"
    />
  ),
);
SheetBackdrop.displayName = "SheetBackdrop";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: HANDLE BAR
// ─────────────────────────────────────────────────────────────────────────────

const HandleBar = memo(() => (
  <div className="flex justify-center pt-3 pb-1 shrink-0">
    <motion.div
      className="h-1 rounded-full bg-white/15"
      style={{ width: 36 }}
      whileHover={{ width: 48, backgroundColor: "rgba(255,255,255,0.28)" }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    />
  </div>
));
HandleBar.displayName = "HandleBar";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: ACTION BUTTON ROW
// ─────────────────────────────────────────────────────────────────────────────

interface ActionItem {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  /** Màu accent — dùng cho các action nguy hiểm (delete) hoặc active (follow) */
  variant?: "default" | "danger" | "active";
  disabled?: boolean;
}

const ActionButton = memo(
  ({
    icon: Icon,
    label,
    onClick,
    variant = "default",
    disabled,
  }: ActionItem) => (
    <motion.button
      whileTap={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-3.5",
        "hover:bg-white/4 transition-colors text-left",
        "disabled:opacity-30 disabled:pointer-events-none",
        variant === "default" && "text-white/75 hover:text-white",
        variant === "danger" && "text-red-400/80 hover:text-red-400",
        variant === "active" && "text-emerald-400",
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 shrink-0",
          variant === "default" && "text-white/40",
          variant === "danger" && "text-red-400/60",
          variant === "active" && "text-emerald-400/70",
        )}
      />
      <span className="text-[14px] font-medium">{label}</span>
    </motion.button>
  ),
);
ActionButton.displayName = "ActionButton";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: CANCEL FOOTER
// ─────────────────────────────────────────────────────────────────────────────

const CancelFooter = memo(({ onClose }: { onClose: () => void }) => (
  <div className="px-4 pb-6 pt-1">
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={SP.snappy}
      onClick={onClose}
      className="w-full py-3.5 rounded-2xl bg-white/6
             text-white/60 text-[14px] font-semibold
             hover:bg-white/9 transition-colors"
    >
      Hủy
    </motion.button>
  </div>
));
CancelFooter.displayName = "CancelFooter";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: SHEET WRAPPER (drag + spring + a11y)
// ─────────────────────────────────────────────────────────────────────────────

interface SheetWrapperProps {
  ariaLabel: string;
  zIndex?: number;
  children: React.ReactNode;
  onClose: () => void;
}

const SheetWrapper = memo(
  ({ ariaLabel, zIndex = 91, children, onClose }: SheetWrapperProps) => (
    <motion.div
      key="sheet"
      variants={SHEET_VARIANTS}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={SP.sheet}
      className="fixed bottom-0 left-0 right-0 bg-[#131313] border-t border-white/8 rounded-t-3xl"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.28 }}
      dragMomentum={false}
      onDragEnd={(_event: unknown, info: PanInfo) => {
        if (info.offset.y > 60 || info.velocity.y > 400) onClose();
      }}
    >
      {children}
    </motion.div>
  ),
);
SheetWrapper.displayName = "SheetWrapper";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Format duration (giây → "mm phút")
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} giờ ${rem} phút` : `${hrs} giờ`;
}

function formatCount(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const AlbumPreviewRow = memo(({ album }: { album: IAlbum }) => {
  const typeLabel = {
    album: "Album",
    single: "Single",
    ep: "EP",
    compilation: "Compilation",
  }[album.type ?? "album"];

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6">
      {album.coverImage ? (
        <ImageWithFallback
          src={album.coverImage}
          alt={album.title}
          className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center shrink-0 ring-1 ring-white/8">
          <Disc3 className="w-6 h-6 text-white/25" aria-hidden />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 truncate">
          {album.title}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">
          {album.artist?.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white/30 bg-white/6">
            {typeLabel}
          </span>
          {album.releaseYear && (
            <span className="text-[10px] text-white/25">
              {album.releaseYear}
            </span>
          )}
          {album.totalTracks !== undefined && (
            <span className="text-[10px] text-white/25">
              {album.totalTracks} bài
            </span>
          )}
          {album.totalDuration && (
            <span className="text-[10px] text-white/25">
              {formatDuration(album.totalDuration)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
AlbumPreviewRow.displayName = "AlbumPreviewRow";

export interface AlbumSheetProps {
  album: IAlbum | undefined;
  isOpen: boolean;
  onClose: () => void;
  /** Callbacks — inject từ parent hoặc từ Redux dispatch */
  onPlay?: (album: IAlbum) => void;
  onShuffle?: (album: IAlbum) => void;
  onAddToQueue?: (album: IAlbum) => void;
  onAddAllToPlaylist?: (album: IAlbum) => void;
  onOpenAddToPlaylistSheet?: (tracks: ITrack[]) => void;
  onGoToArtist?: (artistId: string) => void;
  onShare?: (album: IAlbum) => void;
  onDownloadAll?: (album: IAlbum) => void;
}

export const AlbumSheet = memo(
  ({
    album,
    isOpen,
    onClose,
    onPlay,
    onShuffle,
    onAddToQueue,
    onAddAllToPlaylist,
    onOpenAddToPlaylistSheet,
    onGoToArtist,
    onShare,
    onDownloadAll,
  }: AlbumSheetProps) => {
    const { togglePlayAlbum, shuffleAlbum, isThisAlbumPlaying } =
      useAlbumPlayback(album);

    const actions = useMemo<ActionItem[]>(() => {
      if (!album) return [];
      return [
        {
          icon: isThisAlbumPlaying ? Pause : Play,
          label: isThisAlbumPlaying ? "Tạm dừng album" : "Phát album",
          onClick: () => {
            togglePlayAlbum();
            onClose();
          },
        },
        {
          icon: Shuffle,
          label: "Phát ngẫu nhiên",
          onClick: () => {
            shuffleAlbum();
            onClose();
          },
        },
        {
          icon: SkipForward,
          label: "Thêm vào hàng chờ",
          onClick: () => {
            onAddToQueue?.(album);
            onClose();
          },
        },
        {
          icon: ListPlus,
          label: "Thêm tất cả vào playlist",
          onClick: () => {
            // Close current sheet, wait for exit animation, then open AddToPlaylistSheet
            onClose();
            if (
              onOpenAddToPlaylistSheet &&
              album.trackIds &&
              album.trackIds.length > 0
            ) {
              const tracks = album.trackIds.map(
                (id) => ({ _id: id }) as ITrack,
              );
              setTimeout(() => onOpenAddToPlaylistSheet(tracks), 220);
            } else if (onAddAllToPlaylist) {
              // Fallback to old behavior if no onOpenAddToPlaylistSheet
              setTimeout(() => onAddAllToPlaylist(album), 220);
            }
          },
        },
        ...(album.artist
          ? [
              {
                icon: Mic2,
                label: `Xem nghệ sĩ: ${album.artist.name}`,
                onClick: () => {
                  onGoToArtist?.(album.artist!._id);
                  onClose();
                },
              } as ActionItem,
            ]
          : []),
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onShare?.(album);
            onClose();
          },
        },
        {
          icon: Download,
          label: "Tải xuống toàn bộ",
          onClick: () => {
            onDownloadAll?.(album);
            onClose();
          },
          disabled: true, // placeholder — enable khi có feature
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      album?._id,
      onPlay,
      onShuffle,
      onAddToQueue,
      onAddAllToPlaylist,
      onOpenAddToPlaylistSheet,
      onGoToArtist,
      onShare,
      onDownloadAll,
      onClose,
    ]);

    return (
      <AnimatePresence>
        {isOpen && album && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={90} />
            <SheetWrapper
              ariaLabel={`Tùy chọn cho album ${album.title}`}
              zIndex={91}
              onClose={onClose}
            >
              <HandleBar />
              <AlbumPreviewRow album={album} />
              <div className="py-2">
                {actions.map((action) => (
                  <ActionButton key={action.label} {...action} />
                ))}
              </div>
              <CancelFooter onClose={onClose} />
            </SheetWrapper>
          </>
        )}
      </AnimatePresence>
    );
  },
);
AlbumSheet.displayName = "AlbumSheet";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST SHEET
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistPreviewRow = memo(({ playlist }: { playlist: IPlaylist }) => {
  const VisibilityIcon = playlist.visibility === "public" ? Globe : Lock;
  const { user } = useAppSelector((state) => state.auth);
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6">
      {playlist.coverImage ? (
        <ImageWithFallback
          src={playlist.coverImage}
          alt={playlist.title}
          className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center shrink-0 ring-1 ring-white/8">
          <ListMusic className="w-6 h-6 text-white/25" aria-hidden />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 truncate">
          {playlist.title}
        </p>
        {playlist.user._id === user?._id && (
          <p className="text-xs text-white/40 truncate mt-0.5">
            {playlist.user.fullName || playlist.user.username}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <VisibilityIcon className="w-2.5 h-2.5 text-white/25" aria-hidden />
          <span className="text-[10px] text-white/25">
            {playlist.totalTracks ?? 0} bài
          </span>
          {playlist.description && (
            <span className="text-[10px] text-white/25 truncate max-w-30">
              {playlist.description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
PlaylistPreviewRow.displayName = "PlaylistPreviewRow";

export interface PlaylistSheetProps {
  playlist: IPlaylist | undefined;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (playlist: IPlaylist) => void;
  onShuffle?: (playlist: IPlaylist) => void;
  onAddToQueue?: (playlist: IPlaylist) => void;
  onEdit?: (playlist: IPlaylist) => void;
  onDelete?: (playlist: IPlaylist) => void;
  onToggleVisibility?: (playlist: IPlaylist) => void;
  onShare?: (playlist: IPlaylist) => void;
  onAddToLibrary?: (playlist: IPlaylist) => void;
}

export const PlaylistSheet = memo(
  ({
    playlist,
    isOpen,
    onClose,
    onPlay,
    onShuffle,
    onAddToQueue,
    onEdit,
    onDelete,
    onToggleVisibility,
    onShare,
    onAddToLibrary,
  }: PlaylistSheetProps) => {
    const { user } = useAppSelector((state) => state.auth);
    const { togglePlayPlaylist, shufflePlaylist, isThisPlaylistPlaying } =
      usePlaylistPlayback(playlist);
    const { deletePlaylist } = usePlaylistMutations();

    const actions = useMemo<ActionItem[]>(() => {
      if (!playlist) return [];
      const userId = user?._id || user?.id;
      const isOwner = playlist.user?._id === userId;

      return [
        {
          icon: isThisPlaylistPlaying ? Pause : Play,
          label: isThisPlaylistPlaying ? "Tạm dừng playlist" : "Phát playlist",
          onClick: () => {
            togglePlayPlaylist();
            onClose();
          },
        },
        {
          icon: Shuffle,
          label: "Phát ngẫu nhiên",
          onClick: () => {
            shufflePlaylist();
            onClose();
          },
        },
        {
          icon: SkipForward,
          label: "Thêm vào hàng chờ",
          onClick: () => {
            onAddToQueue?.(playlist);
            onClose();
          },
        },
        ...(isOwner
          ? [
              {
                icon: Edit3,
                label: "Chỉnh sửa playlist",
                onClick: () => {
                  onEdit?.(playlist);
                  onClose();
                },
              } as ActionItem,

              {
                icon: Trash2,
                label: "Xóa playlist",
                onClick: () => {
                  deletePlaylist?.(playlist._id);
                  onClose();
                },
                variant: "danger",
              } as ActionItem,
            ]
          : []),
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onShare?.(playlist);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      playlist?._id,
      playlist?.visibility,
      playlist?.user,
      user?._id,
      onPlay,
      onShuffle,
      onAddToQueue,
      onEdit,
      onDelete,
      onToggleVisibility,
      onShare,
      onAddToLibrary,
      onClose,
    ]);

    return (
      <AnimatePresence>
        {isOpen && playlist && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={90} />
            <SheetWrapper
              ariaLabel={`Tùy chọn cho playlist ${playlist.title}`}
              zIndex={91}
              onClose={onClose}
            >
              <HandleBar />
              <PlaylistPreviewRow playlist={playlist} />
              <div className="py-2">
                {actions.map((action) => (
                  <ActionButton key={action.label} {...action} />
                ))}
              </div>
              <CancelFooter onClose={onClose} />
            </SheetWrapper>
          </>
        )}
      </AnimatePresence>
    );
  },
);
PlaylistSheet.displayName = "PlaylistSheet";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SHEET
// ─────────────────────────────────────────────────────────────────────────────

const ArtistPreviewRow = memo(({ artist }: { artist: IArtist }) => (
  <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6">
    {artist.avatar ? (
      <img
        src={artist.avatar}
        alt={artist.name}
        className="w-14 h-14 rounded-full object-cover ring-1 ring-white/10 shrink-0"
        loading="lazy"
      />
    ) : (
      <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center shrink-0 ring-1 ring-white/8">
        <Mic2 className="w-6 h-6 text-white/25" aria-hidden />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white/90 truncate">
          {artist.name}
        </p>
        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white/30 bg-white/6">
          Nghệ sĩ
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {artist.totalFollowers !== undefined && (
          <span className="text-[10px] text-white/35">
            {formatCount(artist.totalFollowers)} người theo dõi
          </span>
        )}
        {artist.monthlyListeners !== undefined && (
          <span className="text-[10px] text-white/25">
            {formatCount(artist.monthlyListeners)} nghe/tháng
          </span>
        )}
      </div>
    </div>
  </div>
));
ArtistPreviewRow.displayName = "ArtistPreviewRow";

export interface ArtistSheetProps {
  artist: IArtist | undefined;
  isOpen: boolean;
  onClose: () => void;
  onFollow?: (artist: IArtist) => void;
  onUnfollow?: (artist: IArtist) => void;
  onPlayDiscography?: (artist: IArtist) => void;
  onShuffleDiscography?: (artist: IArtist) => void;
  onOpenAddToPlaylistSheet?: (tracks: ITrack[]) => void;
  onViewProfile?: (artist: IArtist) => void;
  onViewTopTracks?: (artist: IArtist) => void;
  onShare?: (artist: IArtist) => void;
  onStartRadio?: (artist: IArtist) => void;
  onAddToQueue?: (artist: IArtist) => void;
}

export const ArtistSheet = memo(
  ({
    artist,
    isOpen,
    onClose,
    onPlayDiscography,
    onShuffleDiscography,
    onAddToQueue,
    onOpenAddToPlaylistSheet,
    onViewProfile,
    onViewTopTracks,
    onShare,
    onStartRadio,
  }: ArtistSheetProps) => {
    // Optimistic follow state (defensive typing — `IArtist` may not declare isFollowing)
    const isFollowing = useAppSelector(
      (state) => !!state.interaction.followedArtists[artist?._id ?? ""],
    );
    const { isThisArtistPlaying, togglePlayArtist, shuffleArtist } =
      useArtistPlayback(artist);
    const { handleToggle } = useInteraction();
    const actions = useMemo<ActionItem[]>(() => {
      if (!artist) return [];
      return [
        {
          icon: isFollowing ? UserCheck : UserPlus,
          label: isFollowing ? "Bỏ theo dõi" : "Theo dõi",
          onClick: () => {
            handleToggle(artist._id, "artist");
          },
          variant: isFollowing ? "active" : "default",
        },
        {
          icon: isThisArtistPlaying ? Pause : Play,
          label: isThisArtistPlaying ? "Tạm dừng" : "Phát nhạc nghệ sĩ",
          onClick: () => {
            togglePlayArtist();
            onClose();
          },
        },
        {
          icon: Shuffle,
          label: "Phát ngẫu nhiên",
          onClick: () => {
            shuffleArtist();
            onClose();
          },
        },
        {
          icon: SkipForward,
          label: "Thêm vào hàng chờ",
          onClick: () => {
            onAddToQueue?.(artist);
            onClose();
          },
        },
        {
          icon: ListPlus,
          label: "Thêm tất cả vào playlist",
          onClick: () => {
            // Close current sheet, wait for exit animation, then open AddToPlaylistSheet
            onClose();
            if (
              onOpenAddToPlaylistSheet &&
              artist.trackIds &&
              artist.trackIds.length > 0
            ) {
              const tracks = artist.trackIds.map(
                (id) => ({ _id: id }) as ITrack,
              );
              setTimeout(() => onOpenAddToPlaylistSheet(tracks), 220);
            }
          },
        },
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onShare?.(artist);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      artist?._id,
      isFollowing,
      handleToggle,
      onPlayDiscography,
      onShuffleDiscography,
      onOpenAddToPlaylistSheet,
      onStartRadio,
      onViewTopTracks,
      onViewProfile,
      onShare,
      onClose,
    ]);

    // NOTE: removed globalThis-based syncing (caused side-effects and extra
    // writes). Rely on React state/selectors for follow status updates instead.

    return (
      <AnimatePresence>
        {isOpen && artist && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={90} />
            <SheetWrapper
              ariaLabel={`Tùy chọn cho nghệ sĩ ${artist.name}`}
              zIndex={91}
              onClose={onClose}
            >
              <HandleBar />
              <ArtistPreviewRow artist={artist} />
              <div className="py-2">
                {actions.map((action) => (
                  <ActionButton key={action.label} {...action} />
                ))}
              </div>
              <CancelFooter onClose={onClose} />
            </SheetWrapper>
          </>
        )}
      </AnimatePresence>
    );
  },
);
ArtistSheet.displayName = "ArtistSheet";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE SHEET
// ─────────────────────────────────────────────────────────────────────────────

const GenrePreviewRow = memo(({ genre }: { genre: IGenre }) => (
  <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6">
    {genre.image ? (
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10 relative">
        <img
          src={genre.image}
          alt={genre.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Color accent overlay từ genre.color */}
        {genre.color && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${genre.color}33 0%, transparent 70%)`,
            }}
          />
        )}
      </div>
    ) : (
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-white/8"
        style={{
          background: genre.color
            ? `${genre.color}22`
            : "rgba(255,255,255,0.06)",
        }}
      >
        <Music2 className="w-6 h-6 text-white/25" aria-hidden />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white/90 truncate">
          {genre.name}
        </p>
        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white/30 bg-white/6">
          Thể loại
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {genre.trackCount !== undefined && (
          <span className="text-[10px] text-white/35">
            {formatCount(genre.trackCount)} bài
          </span>
        )}
      </div>
      {genre.description && (
        <p className="text-[10px] text-white/25 mt-0.5 truncate">
          {genre.description}
        </p>
      )}
    </div>
  </div>
));
GenrePreviewRow.displayName = "GenrePreviewRow";

export interface GenreSheetProps {
  genre: IGenre | undefined;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (genre: IGenre) => void;
  onShuffle?: (genre: IGenre) => void;
  onAddToQueue?: (genre: IGenre) => void;
  onOpenAddToPlaylistSheet?: (tracks: ITrack[]) => void;
  onViewPlaylists?: (genre: IGenre) => void;
  onViewAllTracks?: (genre: IGenre) => void;
  onShare?: (genre: IGenre) => void;
}

export const GenreSheet = memo(
  ({
    genre,
    isOpen,
    onClose,
    onPlay,
    onShuffle,
    onAddToQueue,
    onOpenAddToPlaylistSheet,
    onViewPlaylists,
    onViewAllTracks,
    onShare,
  }: GenreSheetProps) => {
    const { togglePlayGenre, shuffleGenre, isThisGenrePlaying } =
      useGenrePlayback(genre);
    const actions = useMemo<ActionItem[]>(() => {
      if (!genre) return [];
      return [
        {
          icon: isThisGenrePlaying ? Pause : Play,
          label: isThisGenrePlaying
            ? `Tạm dừng ${genre.name}`
            : `Phát nhạc ${genre.name}`,
          onClick: () => {
            togglePlayGenre();
            onClose();
          },
        },
        {
          icon: Shuffle,
          label: "Phát ngẫu nhiên",
          onClick: () => {
            shuffleGenre();
            onClose();
          },
        },
        {
          icon: SkipForward,
          label: "Thêm vào hàng chờ",
          onClick: () => {
            onAddToQueue?.(genre);
            onClose();
          },
        },
        {
          icon: ListPlus,
          label: "Thêm tất cả vào playlist",
          onClick: () => {
            // Close current sheet, wait for exit animation, then open AddToPlaylistSheet
            onClose();
            if (
              onOpenAddToPlaylistSheet &&
              genre.trackIds &&
              genre.trackIds.length > 0
            ) {
              const tracks = genre.trackIds.map(
                (id) => ({ _id: id }) as ITrack,
              );
              setTimeout(() => onOpenAddToPlaylistSheet(tracks), 220);
            }
          },
        },
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onShare?.(genre);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      genre?._id,
      onPlay,
      onShuffle,
      onAddToQueue,
      onOpenAddToPlaylistSheet,
      onViewPlaylists,
      onViewAllTracks,
      onShare,
      onClose,
    ]);

    return (
      <AnimatePresence>
        {isOpen && genre && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={90} />
            <SheetWrapper
              ariaLabel={`Tùy chọn cho thể loại ${genre.name}`}
              zIndex={91}
              onClose={onClose}
            >
              <HandleBar />
              <GenrePreviewRow genre={genre} />
              <div className="py-2">
                {actions.map((action) => (
                  <ActionButton key={action.label} {...action} />
                ))}
              </div>
              <CancelFooter onClose={onClose} />
            </SheetWrapper>
          </>
        )}
      </AnimatePresence>
    );
  },
);
GenreSheet.displayName = "GenreSheet";

// ─────────────────────────────────────────────────────────────────────────────
// Track SHEET
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: TRACK PREVIEW ROW
// ─────────────────────────────────────────────────────────────────────────────

const TrackPreviewRow = memo(({ track }: { track: ITrack }) => {
  const artistName =
    typeof track.artist === "object"
      ? (track.artist?.name ?? "Unknown")
      : "Unknown";
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
      <ImageWithFallback
        src={toCDN(track.coverImage)}
        alt={track.title}
        className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 truncate">
          {track.title}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">{artistName}</p>
      </div>
    </div>
  );
});
TrackPreviewRow.displayName = "TrackPreviewRow";

export interface OptionSheetProps {
  track: ITrack | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlaylist: (track: ITrack) => void;
}

export const OptionSheet = memo(
  ({ track, isOpen, onClose, onAddToPlaylist }: OptionSheetProps) => {
    const { handleToggle } = useInteraction();
    const isLiked = useIsLiked(track?._id || "", "track");

    const options = useMemo(() => {
      if (!track) return [];
      return [
        {
          icon: ListPlus,
          label: "Thêm vào playlist",
          onClick: () => onAddToPlaylist(track),
        },
        {
          icon: Heart,
          label: `${isLiked ? "Bỏ thích" : "Thêm vào yêu thích"}`,
          onClick: () => {
            handleToggle(track?._id || "", "track");
            onClose();
          },
        },
      ];
    }, [track, onAddToPlaylist, onClose, handleToggle, isLiked]);

    return (
      <AnimatePresence>
        {isOpen && track && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={90} />
            <motion.div
              key="option-sheet"
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="fixed bottom-0 left-0 right-0 z-91
                         bg-[#131313] border-t border-white/8 rounded-t-3xl"
              role="dialog"
              aria-modal="true"
              aria-label={`Tùy chọn cho ${track.title}`}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_event: unknown, info: PanInfo) => {
                if (info.offset.y > 60 || info.velocity.y > 400) onClose();
              }}
            >
              <HandleBar />
              <TrackPreviewRow track={track} />

              <div className="py-2">
                {options.map(({ icon: Icon, label, onClick }) => (
                  <motion.button
                    key={label}
                    whileTap={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    onClick={onClick}
                    className="w-full flex items-center gap-4 px-5 py-3.5
                               text-white/75 hover:text-white hover:bg-white/4
                               transition-colors text-left"
                  >
                    <Icon className="w-5 h-5 text-white/40 shrink-0" />
                    <span className="text-[14px] font-medium">{label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="px-4 pb-6 pt-1">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  transition={SP.snappy}
                  onClick={onClose}
                  className="w-full py-3.5 rounded-2xl bg-white/6
                             text-white/60 text-[14px] font-semibold
                             hover:bg-white/9 transition-colors"
                >
                  Hủy
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
OptionSheet.displayName = "OptionSheet";

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO PLAYLIST SHEET — internals
// ─────────────────────────────────────────────────────────────────────────────

// ── Cover art hoặc fallback icon ──────────────────────────────────────────────

const PlaylistCover = memo(({ playlist }: { playlist: IMyPlaylist }) => {
  if (playlist.coverImage) {
    return (
      <ImageWithFallback
        src={playlist.coverImage}
        alt={playlist.title}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/6">
      <ListMusic className="w-4 h-4 text-white/25" aria-hidden />
    </div>
  );
});
PlaylistCover.displayName = "PlaylistCover";

// ── Một dòng playlist ─────────────────────────────────────────────────────────

interface PlaylistRowProps {
  playlist: IMyPlaylist;
  trackId: string;
  isAdding: boolean;
  onAdd: (playlistId: string) => void;
  /** Optional precomputed flag to avoid repeated includes checks */
  isAlreadyAdded?: boolean;
}

const PlaylistRow = memo(
  ({
    playlist,
    trackId,
    isAdding,
    onAdd,
    isAlreadyAdded,
  }: PlaylistRowProps) => {
    const included =
      isAlreadyAdded ?? playlist.tracks?.includes(trackId) ?? false;
    const VisibilityIcon = playlist.visibility === "public" ? Globe : Lock;
    const handleClick = useCallback(() => {
      if (!included && !isAdding) onAdd(playlist._id);
    }, [included, isAdding, onAdd, playlist._id]);

    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 6 }}
        transition={SP.item}
        onClick={handleClick}
        disabled={included || isAdding}
        aria-label={
          included
            ? `${playlist.title} — đã thêm`
            : `Thêm vào ${playlist.title}`
        }
        className={cn(
          "group relative flex items-center gap-3 w-full px-4 py-2.5",
          "text-left transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-xl",
          included
            ? "opacity-50 cursor-default"
            : "hover:bg-white/5 active:bg-white/8 cursor-pointer",
        )}
      >
        {/* Cover */}
        <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/8">
          <PlaylistCover playlist={playlist} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/85 truncate leading-snug">
            {playlist.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <VisibilityIcon className="w-2.5 h-2.5 text-white/25" aria-hidden />
            <span className="text-[11px] text-white/35">
              {playlist.playCount ?? 0} bài
            </span>
          </div>
        </div>

        {/* Status indicator — 3 trạng thái: +, spinner, ✓ */}
        <div className="shrink-0 ml-1">
          <AnimatePresence mode="wait" initial={false}>
            {isAdding ? (
              <motion.div
                key="loading"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={SP.pop}
              >
                <Loader2
                  className="w-4 h-4 text-white/40 animate-spin"
                  aria-hidden
                />
              </motion.div>
            ) : isAlreadyAdded ? (
              <motion.div
                key="done"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={SP.pop}
                className="w-6 h-6 rounded-full flex items-center justify-center
                         bg-emerald-500/15"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
              </motion.div>
            ) : (
              <motion.div
                key="add"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={SP.pop}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  "border border-white/14 text-white/30",
                  "group-hover:border-white/30 group-hover:text-white/70",
                  "group-hover:bg-white/6 transition-all duration-150",
                )}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    );
  },
);
PlaylistRow.displayName = "PlaylistRow";

// ── Loading skeleton ──────────────────────────────────────────────────────────

const PlaylistSkeleton = memo(() => (
  <div className="px-4 py-1 space-y-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-0 py-2.5">
        <div className="w-11 h-11 rounded-xl bg-white/5 shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-white/5 rounded animate-pulse" />
          <div className="h-2.5 w-1/3 bg-white/4 rounded animate-pulse" />
        </div>
        <div className="w-6 h-6 rounded-full bg-white/4 animate-pulse" />
      </div>
    ))}
  </div>
));
PlaylistSkeleton.displayName = "PlaylistSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// QUICK CREATE POPUP — inline popup xuất hiện phía trên nút footer
// Lấy logic từ UserPlaylistModal, stripped down chỉ còn tên playlist
// ─────────────────────────────────────────────────────────────────────────────

const POPUP_SPRING = {
  type: "spring",
  stiffness: 460,
  damping: 30,
  mass: 0.7,
} as const;

interface QuickCreatePopupProps {
  isOpen: boolean;
  isCreating: boolean;
  onConfirm: (title: string) => void;
  onDismiss: () => void;
}

const QuickCreatePopup = memo(
  ({ isOpen, isCreating, onConfirm, onDismiss }: QuickCreatePopupProps) => {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input khi mở
    useEffect(() => {
      if (isOpen) {
        // rAF để đảm bảo animation đã mount xong mới focus
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
      } else {
        setValue("");
      }
    }, [isOpen]);

    const handleSubmit = useCallback(() => {
      onConfirm(value.trim());
    }, [value, onConfirm]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onDismiss();
        }
      },
      [handleSubmit, onDismiss],
    );

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-away backdrop — chỉ đóng popup, không đóng sheet */}
            <motion.div
              key="qcp-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 z-10"
              onClick={onDismiss}
              aria-hidden
            />

            {/* Popup card — xuất hiện từ dưới lên phía trên footer */}
            <motion.div
              key="qcp-card"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={POPUP_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-[250px] left-4 right-4 z-11
                       bg-[#1c1c1c] border border-white/10
                       rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)]
                       overflow-hidden"
              role="dialog"
              aria-modal="false"
              aria-label="Tạo playlist mới"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg bg-white/7
                                flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5 text-white/50" aria-hidden />
                  </div>
                  <span className="text-[13px] font-bold text-white/80">
                    Playlist mới
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={SP.snappy}
                  onClick={onDismiss}
                  disabled={isCreating}
                  aria-label="Đóng"
                  className="p-1 rounded-full text-white/30 hover:text-white/60
                           hover:bg-white/6 transition-colors
                           disabled:pointer-events-none"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>

              {/* Input */}
              <div className="px-4 pb-3">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tên playlist… (tuỳ chọn)"
                    maxLength={100}
                    disabled={isCreating}
                    aria-label="Tên playlist"
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl text-[13px]",
                      "bg-white/6 border border-white/9",
                      "text-white/85 placeholder:text-white/20",
                      "focus:outline-none focus:border-white/25 focus:bg-white/9",
                      "transition-all duration-150",
                      "disabled:opacity-50",
                    )}
                  />
                  {/* Character count — chỉ hiện khi có nội dung */}
                  <AnimatePresence>
                    {value.length > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                                 text-[10px] text-white/20 tabular-nums pointer-events-none"
                      >
                        {value.length}/100
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[10px] text-white/20 mt-1.5 px-0.5">
                  Để trống để tự động đặt tên
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/6 mx-4" />

              {/* Action row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SP.snappy}
                  onClick={onDismiss}
                  disabled={isCreating}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium
                           text-white/40 hover:text-white/65
                           hover:bg-white/5 transition-colors
                           disabled:pointer-events-none"
                >
                  Hủy
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SP.snappy}
                  onClick={handleSubmit}
                  disabled={isCreating}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-[13px] font-semibold",
                    "flex items-center justify-center gap-1.5",
                    "bg-white text-[#131313]",
                    "hover:bg-white/90 transition-colors",
                    "disabled:opacity-50 disabled:pointer-events-none",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isCreating ? (
                      <motion.span
                        key="spin"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang tạo…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Tạo &amp; thêm
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
QuickCreatePopup.displayName = "QuickCreatePopup";

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO PLAYLIST SHEET — main component
// ─────────────────────────────────────────────────────────────────────────────

export interface AddToPlaylistSheetProps {
  tracks: ITrack[] | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToPlaylistSheet = memo(
  ({ tracks, isOpen, onClose }: AddToPlaylistSheetProps) => {
    console.log("Rendering AddToPlaylistSheet", { tracks, isOpen });
    const [search, setSearch] = useState("");
    const [addingId, setAddingId] = useState<string | null>(null);
    const [showCreatePopup, setShowCreatePopup] = useState(false);

    // ── Real data hooks ────────────────────────────────────────────────────
    const { data: playlists, isLoading } = useMyPlaylists();
    const { userAddTracks, createQuickPlaylistAsync, isQuickCreating } =
      usePlaylistMutations();

    // ── Reset khi đóng ─────────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen) {
        setSearch("");
        setAddingId(null);
        setShowCreatePopup(false);
      }
    }, [isOpen]);

    // ── Escape key: đóng popup trước, nếu không có popup thì đóng sheet ───
    useEffect(() => {
      if (!isOpen) return;
      const h = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (showCreatePopup) {
            setShowCreatePopup(false);
          } else {
            onClose();
          }
        }
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [isOpen, showCreatePopup, onClose]);

    // ── Filtered list ──────────────────────────────────────────────────────
    const filtered = useMemo(() => {
      if (!playlists) return [];
      const q = search.trim().toLowerCase();
      if (!q) return playlists;
      return playlists.filter((p: IMyPlaylist) =>
        p.title.toLowerCase().includes(q),
      );
    }, [playlists, search]);

    // ── Add track vào playlist ─────────────────────────────────────────────
    const handleAdd = useCallback(
      async (playlistId: string) => {
        if (!tracks || tracks.length === 0) return;
        setAddingId(playlistId);
        try {
          userAddTracks({ id: playlistId, trackIds: tracks.map((t) => t._id) });
        } finally {
          setTimeout(() => setAddingId(null), 600);
        }
      },
      [tracks, userAddTracks],
    );

    // ── Mở popup khi ấn nút footer ────────────────────────────────────────
    const handleOpenCreatePopup = useCallback(() => {
      setShowCreatePopup(true);
    }, []);

    // ── Xác nhận tạo từ popup: nhận title từ input ────────────────────────
    const handleConfirmCreate = useCallback(
      async (title: string) => {
        if (!tracks || tracks.length === 0) return;
        try {
          const res = await createQuickPlaylistAsync({
            title: title || undefined, // undefined → backend auto-generate tên
            visibility: "private",
          });
          const newId = res?.data?._id;
          if (newId) {
            userAddTracks({ id: newId, trackIds: tracks.map((t) => t._id) });
            setShowCreatePopup(false);
            setTimeout(onClose, 400);
          }
        } catch {
          // error handled trong mutation hook
        }
      },
      [tracks, createQuickPlaylistAsync, userAddTracks, onClose],
    );

    return (
      <AnimatePresence>
        {isOpen && tracks && tracks.length > 0 && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={92} />

            <motion.div
              key="playlist-sheet"
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="fixed bottom-0 left-0 right-0 z-93
                         bg-[#131313] border-t border-white/8
                         rounded-t-3xl flex flex-col"
              style={{ maxHeight: "82%" }}
              role="dialog"
              aria-modal="true"
              aria-label="Thêm vào playlist"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_event: unknown, info: PanInfo) => {
                if (info.offset.y > 60 || info.velocity.y > 400) onClose();
              }}
            >
              <HandleBar />

              {/* ── Header: track chip + close ──────────────────────────────── */}
              <div
                className="flex items-center gap-3 px-4 py-3
                              border-b border-white/[0.06] shrink-0"
              >
                {/* Track mini-preview chip */}
                <div
                  className="flex items-center gap-2.5 flex-1 min-w-0
                             px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {tracks && tracks.length > 0 ? (
                    <ImageWithFallback
                      src={toCDN(tracks[0].coverImage)}
                      alt={tracks[0].title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg bg-white/6 shrink-0
                                    flex items-center justify-center"
                    >
                      <Music2
                        className="w-3.5 h-3.5 text-white/30"
                        aria-hidden
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white/80 truncate leading-snug">
                      {tracks && tracks.length > 0 ? tracks[0].title : ""}
                    </p>
                    {tracks && tracks.length > 0 && tracks[0].artist && (
                      <p className="text-[10px] text-white/35 truncate">
                        {typeof tracks[0].artist === "object"
                          ? tracks[0].artist.name
                          : "—"}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-black uppercase tracking-widest
                                   px-1.5 py-0.5 rounded-md shrink-0
                                   text-white/35 bg-white/6"
                  >
                    Track
                  </span>
                </div>

                {/* Close button */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  transition={SP.snappy}
                  onClick={onClose}
                  aria-label="Đóng"
                  className="p-2 rounded-full text-white/35 hover:text-white/70
                             hover:bg-white/8 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* ── Search bar ───────────────────────────────────────────────── */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2
                               w-3.5 h-3.5 text-white/25 pointer-events-none"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm playlist…"
                    aria-label="Tìm kiếm playlist"
                    className={cn(
                      "w-full h-9 pl-9 pr-3 rounded-xl text-[13px]",
                      "bg-white/5 border border-white/7",
                      "text-white/80 placeholder:text-white/25",
                      "focus:outline-none focus:border-white/20 focus:bg-white/8",
                      "transition-all duration-150",
                    )}
                  />
                </div>
              </div>

              {/* ── Playlist list (scrollable) ────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1">
                {isLoading ? (
                  <PlaylistSkeleton />
                ) : filtered.length === 0 ? (
                  <MusicResult
                    variant="empty-playlists"
                    description="Playlists hiện đang trống"
                  />
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    {filtered.map((pl: IMyPlaylist) => (
                      <PlaylistRow
                        key={pl._id}
                        playlist={pl}
                        trackId={
                          tracks && tracks.length > 0 ? tracks[0]._id : ""
                        }
                        isAdding={addingId === pl._id}
                        onAdd={handleAdd}
                        isAlreadyAdded={
                          !!(
                            playlists &&
                            tracks &&
                            tracks.length > 0 &&
                            pl.tracks?.includes(tracks[0]._id)
                          )
                        }
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* ── Footer: quick create ─────────────────────────────────────── */}
              <div className="relative px-4 py-4 border-t border-white/[0.06] shrink-0">
                {/* Popup xuất hiện phía trên footer */}
                <QuickCreatePopup
                  isOpen={showCreatePopup}
                  isCreating={isQuickCreating}
                  onConfirm={handleConfirmCreate}
                  onDismiss={() => setShowCreatePopup(false)}
                />

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SP.snappy}
                  onClick={handleOpenCreatePopup}
                  disabled={isQuickCreating}
                  className={cn(
                    "w-full py-3 rounded-2xl flex items-center justify-center gap-2",
                    "border border-dashed text-[13px] font-medium",
                    "transition-all duration-200",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    showCreatePopup
                      ? "border-white/25 bg-white/4 text-white/65"
                      : "border-white/12 text-white/40 hover:text-white/65 hover:border-white/25 hover:bg-white/3",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isQuickCreating ? (
                      <motion.span
                        key="creating"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang tạo…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Tạo playlist mới &amp; thêm bài
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
AddToPlaylistSheet.displayName = "AddToPlaylistSheet";

// ─────────────────────────────────────────────────────────────────────────────
// SHEET PRIMITIVES — defined locally to avoid circular deps with Playersheets
// ─────────────────────────────────────────────────────────────────────────────

const QS_BACKDROP_Z = 94;
const QS_SHEET_Z = 95;

const QsBackdrop = memo(({ onClick }: { onClick: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
    style={{ zIndex: QS_BACKDROP_Z }}
    onClick={onClick}
    aria-hidden="true"
  />
));
QsBackdrop.displayName = "QsBackdrop";

const QsHandleBar = memo(() => (
  <div className="flex justify-center pt-3 pb-1 shrink-0">
    <motion.div
      className="h-1 rounded-full bg-white/15"
      style={{ width: 36 }}
      whileHover={{ width: 48, backgroundColor: "rgba(255,255,255,0.28)" }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    />
  </div>
));
QsHandleBar.displayName = "QsHandleBar";

const QUEUE_SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};

const QUEUE_SHEET_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.65,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE SHEET — full-featured bottom sheet wrapping QueuePanel
// ─────────────────────────────────────────────────────────────────────────────

export interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueSheet = memo(({ isOpen, onClose }: QueueSheetProps) => {
  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <QsBackdrop onClick={onClose} />
          <motion.div
            key="queue-sheet"
            variants={QUEUE_SHEET_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={QUEUE_SHEET_SPRING}
            className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-[28px] overflow-hidden"
            style={{
              zIndex: QS_SHEET_Z,
              maxHeight: "88dvh",
              background: "hsl(var(--surface-1, 15 15 15) / 1)",
              backgroundColor: "#111111",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              boxShadow:
                "0 -8px 60px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.05)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Hàng chờ phát nhạc"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.28 }}
            dragMomentum={false}
            onDragEnd={(
              _: unknown,
              info: { offset: { y: number }; velocity: { y: number } },
            ) => {
              if (info.offset.y > 60 || info.velocity.y > 400) onClose();
            }}
          >
            <QsHandleBar />
            <QueuePanel onClose={onClose} showCloseButton />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
QueueSheet.displayName = "QueueSheet";
