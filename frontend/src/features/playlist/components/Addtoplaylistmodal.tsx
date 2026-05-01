import { useEffect, useMemo, memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Loader2,
  Search,
  Check,
  Music2,
  ListMusic,
  Lock,
  Globe,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaylistMutations } from "../hooks/usePlaylistMutations";
import { useMyPlaylists } from "../hooks/usePlaylistsQuery";
import { IMyPlaylist } from "../types";
import { ITrack } from "@/features";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toCDN } from "@/utils/track-helper";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MODAL_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
} as const;

const ITEM_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 30,
} as const;

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: ITrack | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST COVER — stacked mini-tiles or plain image
// ─────────────────────────────────────────────────────────────────────────────

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
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "hsl(var(--primary) / 0.10)" }}
    >
      <ListMusic
        className="size-5"
        style={{ color: "hsl(var(--primary) / 0.55)" }}
        aria-hidden="true"
      />
    </div>
  );
});
PlaylistCover.displayName = "PlaylistCover";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST ROW ITEM
// ─────────────────────────────────────────────────────────────────────────────

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
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={ITEM_SPRING}
        onClick={() => !isAlreadyAdded && onAdd(playlist._id)}
        disabled={isAlreadyAdded || isAdding}
        aria-label={
          isAlreadyAdded
            ? `${playlist.title} — already added`
            : `Add to ${playlist.title}`
        }
        className={cn(
          "group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl",
          "text-left transition-all duration-200 select-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
          isAlreadyAdded
            ? "opacity-60 cursor-default"
            : [
                "hover:bg-surface-2/70 active:scale-[0.98] cursor-pointer",
                "pressable",
              ],
        )}
      >
        {/* Cover art */}
        <div className="shrink-0 size-11 rounded-lg overflow-hidden border border-border/30 shadow-sm">
          <PlaylistCover playlist={playlist} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {playlist.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <VisibilityIcon
              className="size-2.5 text-muted-foreground/50"
              aria-hidden="true"
            />
            <span className="text-[11px] text-muted-foreground/55 font-medium">
              {playlist.playCount} track{playlist.playCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Action indicator */}
        <div className="shrink-0 ml-1">
          {isAdding ? (
            <Loader2
              className="size-4 animate-[spin_0.7s_linear_infinite]"
              style={{ color: "hsl(var(--primary))" }}
              aria-hidden="true"
            />
          ) : isAlreadyAdded ? (
            <div
              className="size-6 rounded-full flex items-center justify-center"
              style={{
                background: "hsl(var(--success) / 0.12)",
                color: "hsl(var(--success))",
              }}
            >
              <Check className="size-3.5" aria-hidden="true" />
            </div>
          ) : (
            <div
              className={cn(
                "size-6 rounded-full flex items-center justify-center",
                "border border-border/40 text-muted-foreground/40",
                "group-hover:border-[hsl(var(--primary)/0.45)] group-hover:text-[hsl(var(--primary))]",
                "group-hover:bg-[hsl(var(--primary)/0.06)]",
                "transition-all duration-150",
              )}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </div>
          )}
        </div>
      </motion.button>
    );
  },
);
PlaylistRow.displayName = "PlaylistRow";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ query }: { query: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-10 gap-2 text-center"
  >
    <div
      className="size-12 rounded-2xl flex items-center justify-center mb-1"
      style={{ background: "hsl(var(--muted) / 0.5)" }}
    >
      {query ? (
        <Search className="size-5 text-muted-foreground/40" />
      ) : (
        <ListMusic className="size-5 text-muted-foreground/40" />
      )}
    </div>
    <p className="text-sm font-semibold text-muted-foreground">
      {query ? `No playlists matching "${query}"` : "No playlists yet"}
    </p>
    <p className="text-[11px] text-muted-foreground/50">
      {query ? "Try a different name" : "Create your first one below"}
    </p>
  </motion.div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK PREVIEW CHIP (top of modal)
// ─────────────────────────────────────────────────────────────────────────────

const TrackChip = memo(({ track }: { track: ITrack }) => (
  <div
    className="flex items-center gap-2.5 px-3 py-2 rounded-xl mx-5 sm:mx-6 mb-0"
    style={{
      background: "hsl(var(--primary) / 0.06)",
      border: "1px solid hsl(var(--primary) / 0.14)",
    }}
  >
    {track.coverImage ? (
      <ImageWithFallback
        src={toCDN(track.coverImage) || track.coverImage}
        alt={track.title}
        className="size-8 rounded-md object-cover shrink-0"
      />
    ) : (
      <div
        className="size-8 rounded-md shrink-0 flex items-center justify-center"
        style={{ background: "hsl(var(--primary) / 0.12)" }}
      >
        <Music2
          className="size-3.5"
          style={{ color: "hsl(var(--primary))" }}
          aria-hidden="true"
        />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-foreground truncate leading-snug">
        {track.title}
      </p>
      {track.artist && (
        <p className="text-[10px] text-muted-foreground/55 truncate">
          {track.artist.name}
        </p>
      )}
    </div>
    <span
      className="text-[10px] font-bold uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded-md"
      style={{
        color: "hsl(var(--primary))",
        background: "hsl(var(--primary) / 0.10)",
      }}
    >
      Track
    </span>
  </div>
));
TrackChip.displayName = "TrackChip";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const AddToPlaylistModal = memo<AddToPlaylistModalProps>(
  ({ isOpen, onClose, track }) => {
    const [search, setSearch] = useState("");
    const [addingId, setAddingId] = useState<string | null>(null);

    const { data: playlists, isLoading } = useMyPlaylists();
    const { userAddTracks, createQuickPlaylistAsync, isQuickCreating } =
      usePlaylistMutations();

    // Scroll lock
    useEffect(() => {
      if (!isOpen) return;
      const sbw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${sbw}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }, [isOpen]);

    // Escape close
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    // Reset state on close
    useEffect(() => {
      if (!isOpen) {
        setSearch("");
        setAddingId(null);
      }
    }, [isOpen]);

    // Filtered list
    const filtered = useMemo(() => {
      if (!playlists) return [];
      const q = search.trim().toLowerCase();
      if (!q) return playlists;
      return playlists.filter((p: IMyPlaylist) =>
        p.title.toLowerCase().includes(q),
      );
    }, [playlists, search]);

    const handleAdd = useCallback(
      async (playlistId: string) => {
        if (!track) return;
        setAddingId(playlistId);
        try {
          userAddTracks({ id: playlistId, trackIds: [track._id] });
        } finally {
          // Optimistic: clear loading after short delay
          setTimeout(() => setAddingId(null), 600);
        }
      },
      [track, userAddTracks],
    );

    const handleQuickCreate = useCallback(async () => {
      if (!track) return;
      try {
        const res = await createQuickPlaylistAsync({
          title: undefined,
          visibility: "private",
        });
        const newId = res?.data?._id;
        if (newId) {
          userAddTracks({ id: newId, trackIds: [track._id] });
        }
      } catch {
        // error handled in mutation
      }
    }, [track, createQuickPlaylistAsync, userAddTracks]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
            role="presentation"
          >
            {/* Backdrop */}
            <motion.div
              key="atpm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 backdrop-blur-md"
              style={{ background: "hsl(var(--overlay) / 0.75)" }}
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Modal shell */}
            <motion.div
              key="atpm-content"
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="atpm-title"
              className={cn(
                "relative z-[101] w-full sm:max-w-sm",
                "flex flex-col max-h-[88dvh] sm:max-h-[82vh]",
                "rounded-t-3xl sm:rounded-2xl",
                "glass-frosted overflow-hidden",
              )}
            >
              {/* Drag handle */}
              <div
                className="sm:hidden flex justify-center pt-3 pb-1 shrink-0"
                aria-hidden="true"
              >
                <div className="w-10 h-1 rounded-full bg-border/60" />
              </div>

              {/* ══ HEADER ══ */}
              <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2.5 rounded-xl shadow-glow-xs shrink-0"
                    style={{
                      background: "hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                      border: "1px solid hsl(var(--primary) / 0.18)",
                    }}
                    aria-hidden="true"
                  >
                    <ListMusic className="size-5" />
                  </div>
                  <div>
                    <h3
                      id="atpm-title"
                      className="text-base font-bold text-foreground leading-tight"
                    >
                      Add to Playlist
                    </h3>
                    <p className="text-track-meta mt-0.5">
                      Choose or create a playlist
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className={cn(
                    "size-8 flex items-center justify-center rounded-full shrink-0",
                    "text-muted-foreground/60",
                    "hover:bg-muted/60 hover:text-foreground",
                    "transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
                  )}
                >
                  <X className="size-4.5" aria-hidden="true" />
                </button>
              </header>

              {/* ══ TRACK CHIP ══ */}
              {track && (
                <div className="pt-3 shrink-0">
                  <TrackChip track={track} />
                </div>
              )}

              {/* ══ SEARCH ══ */}
              <div className="px-5 sm:px-6 pt-3 pb-1 shrink-0">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search playlists…"
                    aria-label="Search playlists"
                    className={cn(
                      "w-full h-9 pl-8 pr-3 rounded-xl text-sm",
                      "bg-surface-1/60 border border-border/40",
                      "text-foreground placeholder:text-muted-foreground/40",
                      "focus:outline-none focus:border-[hsl(var(--primary)/0.45)]",
                      "focus:bg-surface-2/60 transition-all duration-150",
                    )}
                  />
                </div>
              </div>

              {/* ══ SCROLLABLE LIST ══ */}
              <div className="flex-1 overflow-y-auto scrollbar-thin px-5 sm:px-6 py-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2
                      className="size-5 animate-[spin_0.7s_linear_infinite] text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState query={search} />
                ) : (
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-0.5 pb-1">
                      {filtered.map((playlist: IMyPlaylist) => (
                        <PlaylistRow
                          key={playlist._id}
                          playlist={playlist}
                          trackId={track?._id ?? ""}
                          isAdding={addingId === playlist._id}
                          onAdd={handleAdd}
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                )}
              </div>

              {/* ══ FOOTER — Quick create ══ */}
              <footer className="px-5 sm:px-6 py-4 border-t border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={isQuickCreating}
                  className={cn(
                    "w-full h-10 rounded-xl flex items-center justify-center gap-2",
                    "text-sm font-semibold",
                    "border border-dashed border-border/50",
                    "text-muted-foreground/60",
                    "hover:border-[hsl(var(--primary)/0.45)] hover:text-[hsl(var(--primary))]",
                    "hover:bg-[hsl(var(--primary)/0.04)]",
                    "transition-all duration-200 pressable",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
                  )}
                >
                  {isQuickCreating ? (
                    <>
                      <Loader2
                        className="size-3.5 animate-[spin_0.7s_linear_infinite]"
                        aria-hidden="true"
                      />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      New playlist &amp; add track
                    </>
                  )}
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);

AddToPlaylistModal.displayName = "AddToPlaylistModal";
export default AddToPlaylistModal;
