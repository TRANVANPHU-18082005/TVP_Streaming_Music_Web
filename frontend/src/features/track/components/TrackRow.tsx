import React, { memo, useState, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  MoreHorizontal,
  ListPlus,
  PlusCircle,
  Share2,
  Radio,
  ExternalLink,
  Mic2,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/track-helper";
import { Link } from "react-router-dom";
import { ITrack } from "@/features/track/types";
import { useAppSelector } from "@/store/hooks";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  animationDelay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// EqBars — CSS-only via globals.css
// ─────────────────────────────────────────────────────────────────────────────

const EqBars = ({ size = "md" }: { size?: "sm" | "md" }) => (
  <span
    aria-hidden="true"
    className={cn(
      "eq-bars eq-bars--gradient",
      size === "sm" && "eq-bars--thin",
    )}
    style={{ height: size === "sm" ? "12px" : "16px", gap: "1.5px" }}
  >
    {Array.from({ length: 5 }, (_, i) => (
      <span key={i} className="eq-bar" />
    ))}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// PlayCell
// ─────────────────────────────────────────────────────────────────────────────

interface PlayCellProps {
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

const PlayCell = memo(
  ({ index, isActive, isPlaying, onPlay }: PlayCellProps) => {
    const showBars = isActive && isPlaying;

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onPlay();
        }
      },
      [onPlay],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay();
      },
      [onPlay],
    );

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={showBars ? "Pause" : `Play track ${index + 1}`}
        className="relative flex size-full items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Layer 1: Track number */}
        <span
          className={cn(
            "absolute text-[13px] font-medium tabular-nums leading-none",
            "transition-[opacity,transform] duration-200 ease-out",
            isActive
              ? "text-[hsl(var(--primary))]"
              : "text-[hsl(var(--muted-foreground))]",
            showBars
              ? "opacity-0 scale-75"
              : "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75",
          )}
        >
          {index + 1}
        </span>

        {/* Layer 2: EQ bars */}
        <span
          className={cn(
            "absolute flex items-center justify-center",
            "transition-[opacity,transform] duration-200 ease-out",
            showBars
              ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75"
              : "opacity-0 scale-75 pointer-events-none",
          )}
        >
          <EqBars />
        </span>

        {/* Layer 3: Play/Pause icon on hover */}
        <span
          className={cn(
            "absolute flex items-center justify-center",
            "transition-[opacity,transform] duration-200 ease-out",
            "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
          )}
        >
          {isActive && isPlaying ? (
            <Pause
              className="size-[15px]"
              style={{ color: "hsl(var(--foreground))" }}
              strokeWidth={2.5}
            />
          ) : (
            <Play
              className="size-[15px] translate-x-px"
              style={{ color: "hsl(var(--foreground))" }}
              strokeWidth={2.5}
            />
          )}
        </span>
      </div>
    );
  },
);
PlayCell.displayName = "PlayCell";

// ─────────────────────────────────────────────────────────────────────────────
// CoverArt
// ─────────────────────────────────────────────────────────────────────────────

interface CoverArtProps {
  src: string;
  alt: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

const CoverArt = memo(
  ({ src, alt, isActive, isPlaying, onPlay }: CoverArtProps) => (
    <div
      role="button"
      tabIndex={-1}
      aria-hidden="true"
      className="relative size-10 shrink-0 overflow-hidden rounded cursor-pointer select-none"
      style={{
        transition: "box-shadow 0.2s ease",
        boxShadow: isActive
          ? "0 0 0 1.5px hsl(var(--primary)/0.8), 0 0 16px hsl(var(--primary)/0.2)"
          : "none",
      }}
      onClick={onPlay}
    >
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        style={{ transition: "transform 0.45s cubic-bezier(0.16,1,0.3,1)" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLImageElement).style.transform =
            "scale(1.08)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLImageElement).style.transform = "scale(1)")
        }
        loading="lazy"
        decoding="async"
      />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/50",
          "transition-opacity duration-200",
          isActive && isPlaying
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100",
        )}
      >
        {isActive && isPlaying ? (
          <EqBars size="sm" />
        ) : (
          <Play
            className="size-3.5 text-white translate-x-px drop-shadow-sm"
            strokeWidth={2.5}
          />
        )}
      </div>
    </div>
  ),
);
CoverArt.displayName = "CoverArt";

// ─────────────────────────────────────────────────────────────────────────────
// ContextMenu
// ─────────────────────────────────────────────────────────────────────────────

const MENU_ITEM_CLS =
  "flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium cursor-pointer select-none " +
  "text-[hsl(var(--foreground)/0.85)] hover:text-[hsl(var(--foreground))] " +
  "hover:bg-[hsl(var(--muted)/0.7)] focus:bg-[hsl(var(--muted)/0.7)] " +
  "transition-colors duration-100 outline-none";

const ICON_CLS = "size-4 shrink-0 text-[hsl(var(--muted-foreground))]";

interface ContextMenuProps {
  track: ITrack;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ContextMenu = memo(({ track, open, onOpenChange }: ContextMenuProps) => (
  <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button
        size="icon"
        variant="ghost"
        aria-label="More options"
        className={cn(
          "size-7 rounded-full",
          "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          "hover:bg-[hsl(var(--muted)/0.7)]",
          "transition-all duration-150",
          "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0",
          open && "text-[hsl(var(--foreground))] bg-[hsl(var(--muted)/0.7)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      alignOffset={-4}
      sideOffset={6}
      className={cn(
        "w-56 p-1.5 rounded-xl",
        "bg-[hsl(var(--popover))]",
        "border border-[hsl(var(--border))]",
        "shadow-[0_8px_32px_hsl(0_0%_0%/0.22),0_2px_8px_hsl(0_0%_0%/0.12)]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "duration-150",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenuItem className={MENU_ITEM_CLS}>
        <ListPlus className={ICON_CLS} /> Thêm vào danh sách chờ
      </DropdownMenuItem>
      <DropdownMenuItem className={MENU_ITEM_CLS}>
        <PlusCircle className={ICON_CLS} /> Thêm vào Playlist
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1.5 bg-[hsl(var(--border)/0.5)]" />
      <DropdownMenuItem className={MENU_ITEM_CLS}>
        <Radio className={ICON_CLS} /> Phát Radio từ bài này
      </DropdownMenuItem>
      {track.artist?.slug && (
        <DropdownMenuItem className={MENU_ITEM_CLS} asChild>
          <Link
            to={`/artists/${track.artist.slug}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Mic2 className={ICON_CLS} /> Xem trang nghệ sĩ
          </Link>
        </DropdownMenuItem>
      )}
      {track.album?.slug && (
        <DropdownMenuItem className={MENU_ITEM_CLS} asChild>
          <Link
            to={`/albums/${track.album.slug}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className={ICON_CLS} /> Xem Album
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator className="my-1.5 bg-[hsl(var(--border)/0.5)]" />
      <DropdownMenuItem className={MENU_ITEM_CLS}>
        <Share2 className={ICON_CLS} /> Chia sẻ
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));
ContextMenu.displayName = "ContextMenu";

// ─────────────────────────────────────────────────────────────────────────────
// TrackRow — main export
// ─────────────────────────────────────────────────────────────────────────────

export const TrackRow = memo(
  ({
    track,
    index,
    isActive,
    isPlaying,
    onPlay,
    animationDelay = 0,
  }: TrackRowProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const rowRef = useRef<HTMLTableRowElement>(null);
    const isLiked = useAppSelector((state) => {
      const maps = {
        track: "likedTracks",
        album: "likedAlbums",
        playlist: "likedPlaylists",
      } as const;
      return !!state.interaction[maps["track"]][track._id];
    });
    // FIX 2: console.log removed

    const handleRowClick = useCallback(
      (e: React.MouseEvent<HTMLTableRowElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, [role='button'], [data-no-row-click]"))
          return;
        onPlay();
      },
      [onPlay],
    );

    const handlePlayClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay();
      },
      [onPlay],
    );

    return (
      <TableRow
        ref={rowRef}
        data-active={isActive || undefined}
        data-menu-open={menuOpen || undefined}
        onClick={handleRowClick}
        className={cn(
          "group relative h-14 cursor-pointer select-none",
          "border-b border-[hsl(var(--border)/0.06)] last:border-b-0",
          "transition-[background-color,box-shadow] duration-150 ease-out",
          "hover:bg-[hsl(var(--muted)/0.4)]",
          isActive
            ? "bg-[hsl(var(--primary)/0.07)] hover:bg-[hsl(var(--primary)/0.1)]"
            : "",
          menuOpen
            ? "bg-[hsl(var(--muted)/0.55)] hover:bg-[hsl(var(--muted)/0.55)]"
            : "",
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
        aria-current={isActive ? "true" : undefined}
      >
        {/* COL 1 — Play toggle */}
        <TableCell className="w-12 p-0">
          <div className="flex h-14 items-center justify-center">
            <PlayCell
              index={index}
              isActive={isActive}
              isPlaying={isPlaying}
              onPlay={onPlay}
            />
          </div>
        </TableCell>

        {/* COL 2 — Cover + Title + Artist */}
        <TableCell className="py-0 pl-1 pr-4">
          <div className="flex items-center gap-3 min-w-0">
            <CoverArt
              src={track.coverImage}
              alt={track.title}
              isActive={isActive}
              isPlaying={isPlaying}
              onPlay={handlePlayClick}
            />
            <div className="min-w-0 flex-1">
              {isActive && (
                <MarqueeText
                  text={track.title}
                  className="text-sm font-medium leading-snug mb-0.5 text-[hsl(var(--primary))]"
                />
              )}
              {!isActive && (
                <p
                  title={track.title}
                  className={cn(
                    "truncate text-track-title text-sm font-medium leading-snug mb-0.5 transition-colors duration-150",
                    isActive
                      ? "text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--foreground))]",
                  )}
                >
                  {track.title}
                </p>
              )}

              <p className="truncate text-xs leading-snug text-[hsl(var(--muted-foreground))]">
                {track.artist?.slug ? (
                  <Link
                    to={`/artists/${track.artist.slug}`}
                    title={track.artist.name}
                    className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {track.artist.name}
                  </Link>
                ) : (
                  <span>{track.artist?.name}</span>
                )}
              </p>
            </div>
          </div>
        </TableCell>

        {/* COL 3 — Album (hidden < md) */}
        <TableCell className="hidden md:table-cell py-0 pr-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">
            {track.album?.slug ? (
              <Link
                to={`/albums/${track.album.slug}`}
                title={track.album.title}
                className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
                onClick={(e) => e.stopPropagation()}
              >
                {track.album.title}
              </Link>
            ) : (
              <span className="italic opacity-50">Single</span>
            )}
          </p>
        </TableCell>
        <TableCell className="table-cell py-0 pr-4">
          <span
            className={cn(
              // Layout: fixed size prevents cell width changes during Framer scale
              "relative flex items-center justify-center",
              "w-8 h-8 shrink-0",
              // Containment: clips all Framer animations to this box
              "overflow-hidden isolate",
              // Visibility
              "transition-[opacity] duration-150",
              isLiked
                ? "opacity-100 pointer-events-auto"
                : "pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
            )}
            // FIX: contain layout+paint via inline style (not a Tailwind class)
            // `contain: paint` is the critical property — clips filter:blur() overflow
            style={{ contain: "layout paint" }}
          >
            <TrackLikeButton id={track._id} />
          </span>
        </TableCell>

        {/* COL 4 — Actions + Duration */}
        <TableCell className="py-0 pr-3" data-no-row-click="">
          <div className="flex items-center justify-center gap-0.5">
            {/* Duration */}
            <span className="min-w-[38px] text-duration text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))] px-2">
              {formatDuration(track.duration)}
            </span>

            {/*
             * Context menu button — slides in on hover, stays while open.
             * No overflow containment needed here — DropdownMenuContent
             * renders in a Radix portal, outside the table DOM entirely.
             */}
            <span
              className={cn(
                "transition-[opacity,transform] duration-150 hidden md:inline-flex",
                menuOpen
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto",
              )}
            >
              <ContextMenu
                track={track}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              />
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

TrackRow.displayName = "TrackRow";
export default TrackRow;
