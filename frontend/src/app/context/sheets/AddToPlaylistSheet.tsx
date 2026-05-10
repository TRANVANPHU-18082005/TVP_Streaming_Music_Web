import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  ListMusic,
  Globe,
  Lock,
  Plus,
  Loader2,
  Search,
  Check,
  Music2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toCDN } from "@/utils/track-helper";
import { SP, SheetBackdrop, HandleBar } from "../sheetPrimitives";
import { toast } from "sonner";
import {
  IPlaylist,
  useMyPlaylists,
  usePlaylistMutations,
} from "@/features/playlist";
import { ITrack } from "@/features/track";
const SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};
// Playlist cover component
const PlaylistCover = memo(({ playlist }: { playlist: IPlaylist }) => {
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
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <ListMusic className="w-4 h-4 text-muted-foreground" aria-hidden />
    </div>
  );
});
PlaylistCover.displayName = "PlaylistCover";

interface PlaylistRowProps {
  playlist: IPlaylist;
  trackId: string;
  isAdding: boolean;
  onAdd: (playlistId: string) => void;
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
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-xl",
          included
            ? "opacity-50 cursor-default"
            : "hover:bg-muted active:bg-muted cursor-pointer",
        )}
      >
        <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden ring-1 ring-border">
          <PlaylistCover playlist={playlist} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate leading-snug">
            {playlist.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <VisibilityIcon
              className="w-2.5 h-2.5 text-muted-foreground"
              aria-hidden
            />
            <span className="text-[11px] text-muted-foreground">
              {playlist.tracks?.length ?? 0} bài
            </span>
          </div>
        </div>

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
                  className="w-4 h-4 text-muted-foreground animate-spin"
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
                className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/15"
              >
                <Check className="w-3.5 h-3.5 text-primary" aria-hidden />
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
                  "border border-border text-muted-foreground",
                  "group-hover:border-border group-hover:text-foreground/70",
                  "group-hover:bg-muted transition-all duration-150",
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

const PlaylistSkeleton = memo(() => (
  <div className="px-4 py-1 space-y-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-0 py-2.5">
        <div className="w-11 h-11 rounded-xl bg-muted shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-1/3 bg-muted rounded animate-pulse" />
        </div>
        <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
      </div>
    ))}
  </div>
));
PlaylistSkeleton.displayName = "PlaylistSkeleton";

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
    useEffect(() => {
      if (isOpen) {
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
      } else {
        setValue("");
      }
    }, [isOpen]);

    const handleSubmit = useCallback(
      () => onConfirm(value.trim()),
      [value, onConfirm],
    );

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

            <motion.div
              key="qcp-card"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={POPUP_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-[250px] left-4 right-4 z-11 bg-background border border-border rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden"
              role="dialog"
              aria-modal="false"
              aria-label="Tạo playlist mới"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <Plus
                      className="w-3.5 h-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <span className="text-[13px] font-bold text-foreground">
                    Playlist mới
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={SP.snappy}
                  onClick={onDismiss}
                  disabled={isCreating}
                  aria-label="Đóng"
                  className="p-1 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors disabled:pointer-events-none"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>

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
                      "bg-muted border border-border/9",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:border-border focus:bg-muted",
                      "transition-all duration-150",
                      "disabled:opacity-50",
                    )}
                  />
                  <AnimatePresence>
                    {value.length > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums pointer-events-none"
                      >
                        {value.length}/100
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
                  Để trống để tự động đặt tên
                </p>
              </div>

              <div className="h-px bg-muted mx-4" />

              <div className="flex items-center gap-2 px-4 py-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SP.snappy}
                  onClick={onDismiss}
                  disabled={isCreating}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground/65 hover:bg-muted transition-colors disabled:pointer-events-none"
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
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
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
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang
                        tạo…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Tạo &amp; thêm
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

export interface AddToPlaylistSheetProps {
  tracks: ITrack[] | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddToPlaylistSheet = memo(
  ({ tracks, isOpen, onClose }: AddToPlaylistSheetProps) => {
    const [search, setSearch] = useState("");
    const [addingId, setAddingId] = useState<string | null>(null);
    const [showCreatePopup, setShowCreatePopup] = useState(false);

    const { data: playlists, isLoading } = useMyPlaylists();
    const { addTracks, createQuickPlaylistAsync, isCreating } =
      usePlaylistMutations();

    useEffect(() => {
      if (!isOpen) {
        setSearch("");
        setAddingId(null);
        setShowCreatePopup(false);
      }
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const h = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (showCreatePopup) setShowCreatePopup(false);
          else onClose();
        }
      };
      document.addEventListener("keydown", h);
      return () => document.removeEventListener("keydown", h);
    }, [isOpen, showCreatePopup, onClose]);

    const filtered = useMemo(() => {
      if (!playlists) return [];
      const q = search.trim().toLowerCase();
      if (!q) return playlists;
      const filteredPlaylists = playlists.filter((p: IPlaylist) =>
        p.title.toLowerCase().includes(q),
      );
      return filteredPlaylists;
    }, [playlists, search]);

    const handleAdd = useCallback(
      async (playlistId: string) => {
        if (!tracks || tracks.length === 0) return;
        setAddingId(playlistId);
        try {
          addTracks(
            playlistId,
            tracks.map((t) => t._id),
          );
        } finally {
          setTimeout(() => setAddingId(null), 600);
        }
      },
      [tracks, addTracks],
    );

    const handleOpenCreatePopup = useCallback(
      () => setShowCreatePopup(true),
      [],
    );

    const handleConfirmCreate = useCallback(
      async (title: string) => {
        if (!tracks || tracks.length === 0) return;
        try {
          const res = await createQuickPlaylistAsync({
            title: title || undefined,
            visibility: "private",
          });
          const newId = res?.data?._id;
          if (newId) {
            addTracks(
              newId,
              tracks.map((t) => t._id),
            );
            setShowCreatePopup(false);
            setTimeout(onClose, 400);
          }
        } catch {
          toast.error("Tạo playlist thất bại. Vui lòng thử lại.");
        }
      },
      [tracks, createQuickPlaylistAsync, addTracks, onClose],
    );

    return (
      <>
        <AnimatePresence>
          {isOpen && tracks && tracks.length > 0 && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={92} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && tracks && tracks.length > 0 && (
            <motion.div
              key="playlist-sheet"
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-3xl flex flex-col"
              style={{ maxHeight: "82%", zIndex: 93 }}
              role="dialog"
              aria-modal="true"
              aria-label="Thêm vào playlist"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_event: unknown, info: any) => {
                if (info.offset.y > 60 || info.velocity.y > 400) onClose();
              }}
            >
              <HandleBar />

              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/[0.06] shrink-0">
                <div
                  className="flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2 rounded-xl"
                  style={{
                    background: "hsl(var(--muted) / 0.5)",
                    border: "1px solid hsl(var(--border) / 0.5)",
                  }}
                >
                  {tracks && tracks.length > 0 ? (
                    <ImageWithFallback
                      src={toCDN(tracks[0].coverImage)}
                      alt={tracks[0].title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <Music2
                        className="w-3.5 h-3.5 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate leading-snug">
                      {tracks && tracks.length > 0 ? tracks[0].title : ""}
                    </p>
                    {tracks && tracks.length > 0 && tracks[0].artist && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {typeof tracks[0].artist === "object"
                          ? tracks[0].artist.name
                          : "—"}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shrink-0 text-muted-foreground bg-muted">
                    Track
                  </span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  transition={SP.snappy}
                  onClick={onClose}
                  aria-label="Đóng"
                  className="p-2 rounded-full text-muted-foreground hover:text-foreground/70 hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
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
                      "bg-muted border border-border/7",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:border-border focus:bg-muted",
                      "transition-all duration-150",
                    )}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1">
                {isLoading ? (
                  <PlaylistSkeleton />
                ) : filtered.length === 0 ? (
                  <div />
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    {filtered.map((pl: IPlaylist) => (
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
                            tracks.length <= 1 &&
                            pl.tracks?.includes(tracks[0]._id)
                          )
                        }
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>

              <div className="relative px-4 py-4 border-t border-border/[0.06] shrink-0">
                <QuickCreatePopup
                  isOpen={showCreatePopup}
                  isCreating={isCreating}
                  onConfirm={handleConfirmCreate}
                  onDismiss={() => setShowCreatePopup(false)}
                />

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SP.snappy}
                  onClick={handleOpenCreatePopup}
                  disabled={isCreating}
                  className={cn(
                    "w-full py-3 rounded-2xl flex items-center justify-center gap-2",
                    "border border-dashed text-[13px] font-medium",
                    "transition-all duration-200",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    showCreatePopup
                      ? "border-border bg-muted text-foreground/65"
                      : "border-border text-muted-foreground hover:text-foreground/65 hover:border-border hover:bg-foreground/3",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isCreating ? (
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
          )}
        </AnimatePresence>
      </>
    );
  },
);

AddToPlaylistSheet.displayName = "AddToPlaylistSheet";

export default AddToPlaylistSheet;
