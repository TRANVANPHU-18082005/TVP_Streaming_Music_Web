// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST SHEET
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play,
  Shuffle,
  Share2,
  SkipForward,
  Pause,
  Globe,
  ListMusic,
  Trash2,
  Lock,
} from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

import {
  ActionButton,
  ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "../sheetPrimitives";
import {
  appendQueueIds,
  IPlaylist,
  IPlaylistDetail,
  playlistKeys,
  selectPlayer,
  usePlaylistMutations,
} from "@/features";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import { toast } from "sonner";
import playlistApi from "@/features/playlist/api/playlistApi";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
const PlaylistPreviewRow = memo(({ playlist }: { playlist: IPlaylist }) => {
  const { user } = useAppSelector((state) => state.auth);
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
      {playlist.coverImage ? (
        <ImageWithFallback
          src={playlist.coverImage}
          alt={playlist.title}
          className="w-14 h-14 rounded-xl object-cover ring-1 ring-border shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
          <ListMusic className="w-6 h-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {playlist.title}
        </p>
        {playlist.user._id === user?._id && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {playlist.user.fullName || playlist.user.username}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {playlist.visibility === "public" ? (
            <Globe className="w-2.5 h-2.5 text-muted-foreground" aria-hidden />
          ) : (
            <Lock className="w-2.5 h-2.5 text-muted-foreground" aria-hidden />
          )}

          <span className="text-[10px] text-muted-foreground">
            {playlist.totalTracks ?? 0} bài
          </span>
          {playlist.description && (
            <span className="text-[10px] text-muted-foreground truncate max-w-30">
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
  playlist: IPlaylistDetail | undefined;
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
    onEdit,
    onDelete,
  }: PlaylistSheetProps) => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);
    const { togglePlayPlaylist, shufflePlaylist, isThisPlaylistPlaying } =
      usePlaylistPlayback(playlist);
    const { toggleDeletePlaylist, isToggleDeleting } = usePlaylistMutations();
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const player = useAppSelector(selectPlayer);
    const { play } = usePlayCollection();
    const onPlaylistShare = (playlist: IPlaylistDetail) => {
      navigator.share?.({
        title: (playlist as IPlaylist).title,
        url: `/playlists/${(playlist as IPlaylist)._id}`,
      });
    };
    const onPlaylistAddToQueue = (playlist: IPlaylistDetail) => {
      if (
        !("trackIds" in playlist) ||
        !playlist.trackIds ||
        playlist.trackIds.length === 0
      ) {
        toast.error(`Không có bài nào để thêm vào hàng đợi`);
        return;
      }

      // If queue is empty -> directly play this genre (replace queue + start)
      if (!player.activeQueueIds || player.activeQueueIds.length === 0) {
        // Use play flow which will fetch detail, setQueue and start playback
        play({
          queryKey: playlistKeys.detail(playlist._id || playlist.slug),
          fetchFn: () => playlistApi.getDetail(playlist._id),
          sourceType: "playlist",
          startIndex: 0,
          collectionName: playlist.title,
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

      const newIds = playlist.trackIds.filter((id) => !existingSet.has(id));

      if (newIds.length === 0) {
        toast(
          `Tất cả bài của playlist "${playlist.title}" đã có trong hàng đợi`,
          {
            action: {
              label: "Mở trình phát",
              onClick: () => {
                /* optional: open or focus player UI */
              },
            },
          },
        );
        return;
      }

      dispatch(appendQueueIds(newIds));

      const addedCount = newIds.length;
      const dupCount = playlist.trackIds.length - addedCount;
      if (dupCount > 0) {
        toast.success(
          `Đã thêm ${addedCount} bài vào hàng đợi — ${dupCount} bài đã có sẵn`,
        );
      } else {
        toast.success(
          `Đã thêm ${addedCount} bài của playlist "${playlist.title}" vào hàng đợi`,
        );
      }
    };
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
            onPlaylistAddToQueue?.(playlist);
            onClose();
          },
        },
        ...(isOwner
          ? [
            {
              icon: Trash2,
              label: "Xóa playlist",
              onClick: () => {
                setConfirmOpen(true);
              },
              variant: "danger",
            } as ActionItem,
          ]
          : []),
        {
          icon: Share2,
          label: "Chia sẻ",
          onClick: () => {
            onPlaylistShare?.(playlist);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      playlist?._id,
      user?._id,
      onPlay,
      onShuffle,
      onEdit,
      onDelete,

      onClose,
    ]);

    return (
      <>
        <AnimatePresence>
          {isOpen && playlist && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && playlist && (
            <SheetWrapper
              key="wrapper"
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
          )}
        </AnimatePresence>
        {/* 4. Delete Confirmation */}
        <ConfirmationModal
          isOpen={isConfirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            if (playlist) toggleDeletePlaylist({ id: playlist._id, isDelete: true });
          }}
          title="Xóa playlist?"
          isLoading={isToggleDeleting}
          countdownSeconds={3}
          description={
            <div>
              <p className="text-sm text-foreground/80 mb-2">
                Bạn có chắc chắn muốn xóa playlist{" "}
                <strong className="text-foreground">
                  {playlist?.title}
                </strong>
                ?
              </p>
            </div>
          }
          confirmLabel="Xóa playlist"
          isDestructive
        />
      </>
    );
  },
);
PlaylistSheet.displayName = "PlaylistSheet";
