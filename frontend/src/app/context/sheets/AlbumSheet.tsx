// ─────────────────────────────────────────────────────────────────────────────
// ALBUM SHEET
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play,
  Shuffle,
  ListPlus,
  Share2,
  Disc3,
  SkipForward,
  Mic2,
  Pause,
} from "lucide-react";

import { IAlbum } from "@/features/album/types";

import {
  albumKeys,
  appendQueueIds,
  IAlbumDetail,
  ITrack,
  selectPlayer,
} from "@/features";

import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

import { formatDuration } from "@/utils/track-helper";
import {
  ActionButton,
  ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "../sheetPrimitives";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import albumApi from "@/features/album/api/albumApi";
import { useNavigate } from "react-router-dom";
const AlbumPreviewRow = memo(({ album }: { album: IAlbum }) => {
  const typeLabel = {
    album: "Album",
    single: "Single",
    ep: "EP",
    compilation: "Compilation",
  }[album.type ?? "album"];

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
      {album.coverImage ? (
        <ImageWithFallback
          src={album.coverImage}
          alt={album.title}
          className="w-14 h-14 rounded-xl object-cover ring-1 ring-border shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
          <Disc3 className="w-6 h-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {album.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {album.artist?.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted">
            {typeLabel}
          </span>
          {album.releaseYear && (
            <span className="text-[10px] text-muted-foreground">
              {album.releaseYear}
            </span>
          )}
          {album.totalTracks !== undefined && (
            <span className="text-[10px] text-muted-foreground">
              {album.totalTracks} bài
            </span>
          )}
          {album.totalDuration && (
            <span className="text-[10px] text-muted-foreground">
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
  album: IAlbumDetail | undefined;
  isOpen: boolean;
  onClose: () => void;
  onOpenAddToPlaylistSheet?: (tracks: ITrack[]) => void;
}

export const AlbumSheet = memo(
  ({ album, isOpen, onClose, onOpenAddToPlaylistSheet }: AlbumSheetProps) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const { togglePlayAlbum, shuffleAlbum, isThisAlbumPlaying } =
      useAlbumPlayback(album);
    const player = useAppSelector(selectPlayer);
    const { play } = usePlayCollection();
    const onAlbumGoToArtist = (slug: string) => navigate(`/artists/${slug}`);
    const onAlbumShare = (album: IAlbumDetail) => {
      navigator.share?.({
        title: (album as IAlbum).title,
        url: `/albums/${(album as IAlbum).slug}`,
      });
    };
    const onAlbumAddToQueue = (album: IAlbumDetail) => {
      if (
        !("trackIds" in album) ||
        !album.trackIds ||
        album.trackIds.length === 0
      ) {
        toast.error(`Không có bài nào để thêm vào hàng đợi`);
        return;
      }

      // If queue is empty -> directly play this genre (replace queue + start)
      if (!player.activeQueueIds || player.activeQueueIds.length === 0) {
        // Use play flow which will fetch detail, setQueue and start playback
        play({
          queryKey: albumKeys.detail(album._id || album.slug),
          fetchFn: () => albumApi.getAlbumDetail(album.slug),
          sourceType: "album",
          startIndex: 0,
          collectionName: album.title,
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

      const newIds = album.trackIds.filter((id) => !existingSet.has(id));

      if (newIds.length === 0) {
        toast(`Tất cả bài của album "${album.title}" đã có trong hàng đợi`, {
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
      const dupCount = album.trackIds.length - addedCount;
      if (dupCount > 0) {
        toast.success(
          `Đã thêm ${addedCount} bài vào hàng đợi — ${dupCount} bài đã có sẵn`,
        );
      } else {
        toast.success(
          `Đã thêm ${addedCount} bài của album "${album.title}" vào hàng đợi`,
        );
      }
    };
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
            onAlbumAddToQueue?.(album);
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
              "trackIds" in album &&
              album.trackIds &&
              album.trackIds.length > 0
            ) {
              const tracks = album.trackIds.map(
                (id: string) => ({ _id: id }) as ITrack,
              );
              setTimeout(() => onOpenAddToPlaylistSheet(tracks), 220);
            }
          },
        },
        ...(album.artist
          ? [
              {
                icon: Mic2,
                label: `Xem nghệ sĩ: ${album.artist.name}`,
                onClick: () => {
                  onAlbumGoToArtist?.(album.artist!.slug);
                  onClose();
                },
              } as ActionItem,
            ]
          : []),
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onAlbumShare?.(album);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [album?._id, onOpenAddToPlaylistSheet, onClose]);

    return (
      <>
        <AnimatePresence>
          {isOpen && album && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && album && (
            <SheetWrapper
              key="wrapper"
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
          )}
        </AnimatePresence>
      </>
    );
  },
);
AlbumSheet.displayName = "AlbumSheet";
