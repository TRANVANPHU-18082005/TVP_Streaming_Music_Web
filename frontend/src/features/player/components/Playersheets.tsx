import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Heart,
  ListPlus,
  ListMusic,
  Share2,
  Radio,
  Music2,
  Check,
  X,
  Plus,
  Globe,
  Lock,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";

import { ITrack } from "@/features/track/types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useMyPlaylists } from "@/features/playlist/hooks/usePlaylistsQuery";
import { usePlaylistMutations } from "@/features/playlist/hooks/usePlaylistMutations";
import { IMyPlaylist } from "@/features/playlist/types";
import { QueuePanel } from "@/features/player/components/Queuepanel";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
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
      className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
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
        src={track.coverImage}
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

// ─────────────────────────────────────────────────────────────────────────────
// OPTION SHEET
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionSheetProps {
  track: ITrack | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlaylist: (track: ITrack) => void;
}

export const OptionSheet = memo(
  ({ track, isOpen, onClose, onAddToPlaylist }: OptionSheetProps) => {
    const options = useMemo(
      () =>
        track
          ? [
              {
                icon: ListPlus,
                label: "Thêm vào playlist",
                onClick: () => onAddToPlaylist(track),
              },
              {
                icon: Heart,
                label: "Thêm vào yêu thích",
                onClick: onClose,
              },
              {
                icon: Radio,
                label: "Phát radio từ bài này",
                onClick: onClose,
              },
              {
                icon: Share2,
                label: "Chia sẻ",
                onClick: onClose,
              },
            ]
          : [],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [track?._id, onAddToPlaylist, onClose],
    );

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
              className="absolute bottom-0 left-0 right-0 z-[91]
                         bg-[#131313] border-t border-white/[0.08] rounded-t-3xl"
              role="dialog"
              aria-modal="true"
              aria-label={`Tùy chọn cho ${track.title}`}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_: any, info: any) => {
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
                               text-white/75 hover:text-white hover:bg-white/[0.04]
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
                  className="w-full py-3.5 rounded-2xl bg-white/[0.06]
                             text-white/60 text-[14px] font-semibold
                             hover:bg-white/[0.09] transition-colors"
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
      <img
        src={playlist.coverImage}
        alt={playlist.title}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
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
}

const PlaylistRow = memo(
  ({ playlist, trackId, isAdding, onAdd }: PlaylistRowProps) => {
    const isAlreadyAdded = playlist.tracks?.includes(trackId) ?? false;
    const VisibilityIcon = playlist.visibility === "public" ? Globe : Lock;

    return (
      <motion.button
        type="button"
        layout="position"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 6 }}
        transition={SP.item}
        onClick={() => !isAlreadyAdded && !isAdding && onAdd(playlist._id)}
        disabled={isAlreadyAdded || isAdding}
        aria-label={
          isAlreadyAdded
            ? `${playlist.title} — đã thêm`
            : `Thêm vào ${playlist.title}`
        }
        className={cn(
          "group relative flex items-center gap-3 w-full px-4 py-2.5",
          "text-left transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-xl",
          isAlreadyAdded
            ? "opacity-50 cursor-default"
            : "hover:bg-white/[0.05] active:bg-white/[0.08] cursor-pointer",
        )}
      >
        {/* Cover */}
        <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/[0.08]">
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
                  "border border-white/[0.14] text-white/30",
                  "group-hover:border-white/30 group-hover:text-white/70",
                  "group-hover:bg-white/[0.06] transition-all duration-150",
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

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = memo(({ query }: { query: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={SP.snappy}
    className="flex flex-col items-center justify-center py-10 gap-2"
  >
    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-1">
      {query ? (
        <Search className="w-5 h-5 text-white/20" />
      ) : (
        <ListPlus className="w-5 h-5 text-white/20" />
      )}
    </div>
    <p className="text-[13px] font-semibold text-white/35">
      {query ? `Không tìm thấy "${query}"` : "Chưa có playlist nào"}
    </p>
    <p className="text-[11px] text-white/20">
      {query ? "Thử tên khác" : "Tạo playlist đầu tiên bên dưới"}
    </p>
  </motion.div>
));
EmptyState.displayName = "EmptyState";

// ── Loading skeleton ──────────────────────────────────────────────────────────

const PlaylistSkeleton = memo(() => (
  <div className="px-4 py-1 space-y-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-0 py-2.5">
        <div className="w-11 h-11 rounded-xl bg-white/[0.05] shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-white/[0.05] rounded animate-pulse" />
          <div className="h-2.5 w-1/3 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="w-6 h-6 rounded-full bg-white/[0.04] animate-pulse" />
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
              className="absolute inset-0 z-[10]"
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
              className="absolute bottom-[76px] left-4 right-4 z-[11]
                       bg-[#1c1c1c] border border-white/[0.1]
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
                    className="w-6 h-6 rounded-lg bg-white/[0.07]
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
                           hover:bg-white/[0.06] transition-colors
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
                      "bg-white/[0.06] border border-white/[0.09]",
                      "text-white/85 placeholder:text-white/20",
                      "focus:outline-none focus:border-white/25 focus:bg-white/[0.09]",
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
              <div className="h-px bg-white/[0.06] mx-4" />

              {/* Action row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SP.snappy}
                  onClick={onDismiss}
                  disabled={isCreating}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium
                           text-white/40 hover:text-white/65
                           hover:bg-white/[0.05] transition-colors
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
  track: ITrack | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToPlaylistSheet = memo(
  ({ track, isOpen, onClose }: AddToPlaylistSheetProps) => {
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
        if (!track) return;
        setAddingId(playlistId);
        try {
          userAddTracks({ id: playlistId, trackIds: [track._id] });
        } finally {
          setTimeout(() => setAddingId(null), 600);
        }
      },
      [track, userAddTracks],
    );

    // ── Mở popup khi ấn nút footer ────────────────────────────────────────
    const handleOpenCreatePopup = useCallback(() => {
      setShowCreatePopup(true);
    }, []);

    // ── Xác nhận tạo từ popup: nhận title từ input ────────────────────────
    const handleConfirmCreate = useCallback(
      async (title: string) => {
        if (!track) return;
        try {
          const res = await createQuickPlaylistAsync({
            title: title || undefined, // undefined → backend auto-generate tên
            visibility: "private",
          });
          const newId = res?.data?._id;
          if (newId) {
            userAddTracks({ id: newId, trackIds: [track._id] });
            setShowCreatePopup(false);
            setTimeout(onClose, 400);
          }
        } catch {
          // error handled trong mutation hook
        }
      },
      [track, createQuickPlaylistAsync, userAddTracks, onClose],
    );

    return (
      <AnimatePresence>
        {isOpen && track && (
          <>
            <SheetBackdrop onClick={onClose} zIndex={92} />

            <motion.div
              key="playlist-sheet"
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="absolute bottom-0 left-0 right-0 z-[93]
                         bg-[#131313] border-t border-white/[0.08]
                         rounded-t-3xl flex flex-col"
              style={{ maxHeight: "82%" }}
              role="dialog"
              aria-modal="true"
              aria-label="Thêm vào playlist"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_: any, info: any) => {
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
                  {track.coverImage ? (
                    <ImageWithFallback
                      src={track.coverImage}
                      alt={track.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg bg-white/[0.06] shrink-0
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
                      {track.title}
                    </p>
                    {track.artist && (
                      <p className="text-[10px] text-white/35 truncate">
                        {typeof track.artist === "object"
                          ? track.artist.name
                          : "—"}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-black uppercase tracking-widest
                                   px-1.5 py-0.5 rounded-md shrink-0
                                   text-white/35 bg-white/[0.06]"
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
                             hover:bg-white/[0.08] transition-colors shrink-0"
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
                      "bg-white/[0.05] border border-white/[0.07]",
                      "text-white/80 placeholder:text-white/25",
                      "focus:outline-none focus:border-white/20 focus:bg-white/[0.08]",
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
                  <EmptyState query={search} />
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filtered.map((pl: IMyPlaylist) => (
                      <PlaylistRow
                        key={pl._id}
                        playlist={pl}
                        trackId={track._id}
                        isAdding={addingId === pl._id}
                        onAdd={handleAdd}
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
                      ? "border-white/25 bg-white/[0.04] text-white/65"
                      : "border-white/[0.12] text-white/40 hover:text-white/65 hover:border-white/25 hover:bg-white/[0.03]",
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
// TRACK QUEUE SHEET
// Mobile bottom-sheet wrapper cho QueuePanel.
// Tách khỏi FullPlayer để tái sử dụng và dễ test độc lập.
//
// Đồng bộ pattern với AddToPlaylistSheet:
//   • SheetBackdrop     — backdrop nhất quán, cùng motion props
//   • HandleBar         — handle bar dùng chung, không duplicate
//   • SHEET_VARIANTS    — variants dùng chung thay vì inline initial/animate/exit
//   • SP.sheet          — spring preset nhất quán
//   • rAF focus trap    — đảm bảo focus sau khi animation mount xong
//   • Escape key        — pattern useEffect cleanup giống các sheet khác
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_COLLAPSE_Y = 72;
const QUEUE_COLLAPSE_VY = 400;

export interface TrackQueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrackQueueSheet = memo(
  ({ isOpen, onClose }: TrackQueueSheetProps) => {
    const sheetRef = useRef<HTMLDivElement>(null);

    // ── Escape key — pattern giống AddToPlaylistSheet ──────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const h = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [isOpen, onClose]);

    // ── rAF focus trap — đảm bảo animation xong mới focus ─────────────────
    // (cùng pattern với QuickCreatePopup để tránh jank)
    useEffect(() => {
      if (!isOpen) return;
      const id = requestAnimationFrame(() => {
        const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.[0]?.focus();
      });
      return () => cancelAnimationFrame(id);
    }, [isOpen]);

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* SheetBackdrop — nhất quán với OptionSheet & AddToPlaylistSheet */}
            <SheetBackdrop onClick={onClose} zIndex={75} />

            {/* Sheet */}
            <motion.div
              key="queue-sheet"
              ref={sheetRef}
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="lg:hidden absolute bottom-0 left-0 right-0 z-[80]
                       bg-[#0f0f0f] border-t border-white/[0.08]
                       rounded-t-3xl flex flex-col"
              style={{ maxHeight: "calc(var(--vh, 1vh) * 76)" }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.22 }}
              dragMomentum={false}
              onDragEnd={(_: any, info: any) => {
                if (
                  info.offset.y > QUEUE_COLLAPSE_Y ||
                  info.velocity.y > QUEUE_COLLAPSE_VY
                )
                  onClose();
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Queue"
            >
              {/* HandleBar — dùng chung, không inline duplicate */}
              <HandleBar />

              {/* QueuePanel chiếm toàn bộ chiều cao còn lại */}
              <div className="flex-1 min-h-0">
                <QueuePanel onClose={onClose} showCloseButton />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
TrackQueueSheet.displayName = "TrackQueueSheet";
