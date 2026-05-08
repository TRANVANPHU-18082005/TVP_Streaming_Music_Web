// ─────────────────────────────────────────────────────────────────────────────
// GENRE SHEET
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play,
  Shuffle,
  ListPlus,
  Share2,
  SkipForward,
  Pause,
  Music2,
} from "lucide-react";

import {
  appendQueueIds,
  IGenre,
  IGenreDetail,
  ITrack,
  selectPlayer,
} from "@/features";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import { genreKeys } from "@/features/genre/utils/genreKeys";
import genreApi from "@/features/genre/api/genreApi";

import {
  ActionButton,
  ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "../sheetPrimitives";
import { formatCount } from "@/utils/track-helper";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const GenrePreviewRow = memo(({ genre }: { genre: IGenre }) => (
  <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
    {genre.image ? (
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-border relative">
        <ImageWithFallback
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
              background: genre.gradient
                ? genre.gradient
                : genre.color
                  ? `linear-gradient(135deg, ${genre.color}33, ${genre.color}99)`
                  : undefined,
            }}
          />
        )}
      </div>
    ) : (
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border"
        style={{
          background: genre.color
            ? `${genre.color}22`
            : "hsl(var(--muted) / 0.8)",
        }}
      >
        <Music2 className="w-6 h-6 text-muted-foreground" aria-hidden />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground truncate">
          {genre.name}
        </p>
        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted">
          Thể loại
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {genre.trackCount !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {formatCount(genre.trackCount)} bài
          </span>
        )}
      </div>
      {genre.description && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {genre.description}
        </p>
      )}
    </div>
  </div>
));
GenrePreviewRow.displayName = "GenrePreviewRow";

export interface GenreSheetProps {
  genre?: IGenreDetail;
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

    onOpenAddToPlaylistSheet,
  }: GenreSheetProps) => {
    const dispatch = useAppDispatch();
    const { togglePlayGenre, shuffleGenre, isThisGenrePlaying } =
      useGenrePlayback(genre as IGenre | undefined);
    const player = useAppSelector(selectPlayer);
    const { play } = usePlayCollection();
    const onGenreShare = (genre: IGenreDetail) => {
      navigator.share?.({
        title: (genre as IGenre).name,
        url: `/genres/${(genre as IGenre).slug}`,
      });
    };
    const onGenreAddToQueue = (genre: IGenreDetail) => {
      if (
        !("trackIds" in genre) ||
        !genre.trackIds ||
        genre.trackIds.length === 0
      ) {
        toast.error(`Không có bài nào để thêm vào hàng đợi`);
        return;
      }

      // If queue is empty -> directly play this genre (replace queue + start)
      if (!player.activeQueueIds || player.activeQueueIds.length === 0) {
        // Use play flow which will fetch detail, setQueue and start playback
        play({
          queryKey: genreKeys.detail(genre._id || genre.slug),
          fetchFn: () => genreApi.getGenreDetail(genre.slug),
          sourceType: "genre",
          startIndex: 0,
          collectionName: genre.name,
          shuffle: false,
        });

        // play() already shows toasts for loading / success / error
        return;
      }

      // Otherwise append only new ids to existing queue (dedupe)
      const existingSet = new Set(
        (player.activeQueueIds && player.activeQueueIds.length > 0
          ? player.activeQueueIds
          : player.originalQueueIds) || [],
      );

      const newIds = genre.trackIds.filter((id) => !existingSet.has(id));

      if (newIds.length === 0) {
        toast(`Tất cả bài của thể loại "${genre.name}" đã có trong hàng đợi`, {
          action: {
            label: "Mở trình phát",
            onClick: () => {
              /* optional: open or focus player UI */
            },
          },
        });
        return;
      }

      dispatch(appendQueueIds(newIds));

      const addedCount = newIds.length;
      const dupCount = genre.trackIds.length - addedCount;
      if (dupCount > 0) {
        toast.success(
          `Đã thêm ${addedCount} bài vào hàng đợi — ${dupCount} bài đã có sẵn`,
        );
      } else {
        toast.success(
          `Đã thêm ${addedCount} bài của thể loại "${genre.name}" vào hàng đợi`,
        );
      }
    };
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
            onGenreAddToQueue?.(genre);
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
              "trackIds" in genre &&
              genre.trackIds &&
              genre.trackIds.length > 0
            ) {
              const tracks = genre.trackIds.map(
                (id: string) => ({ _id: id }) as ITrack,
              );
              setTimeout(() => onOpenAddToPlaylistSheet(tracks), 220);
            }
          },
        },
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onGenreShare?.(genre);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genre?._id, onOpenAddToPlaylistSheet, onClose]);

    return (
      <>
        <AnimatePresence>
          {isOpen && genre && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && genre && (
            <SheetWrapper
              key="wrapper"
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
          )}
        </AnimatePresence>
      </>
    );
  },
);
GenreSheet.displayName = "GenreSheet";
