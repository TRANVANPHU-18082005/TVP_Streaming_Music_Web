// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SHEET
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play,
  Shuffle,
  ListPlus,
  Share2,
  SkipForward,
  Mic2,
  Pause,
  UserPlus,
  UserCheck,
} from "lucide-react";

import {
  ActionButton,
  ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "../sheetPrimitives";
import { formatCount } from "@/utils/track-helper";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import { toast } from "sonner";
import artistApi from "@/features/artist/api/artistApi";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { artistKeys, IArtist, IArtistDetail } from "@/features/artist";
import { ITrack } from "@/features/track";
import { appendQueueIds, selectPlayer } from "@/features/player";
import { useInteraction } from "@/features/interaction";
const ArtistPreviewRow = memo(({ artist }: { artist: IArtist }) => (
  <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
    {artist.avatar ? (
      <ImageWithFallback
        src={artist.avatar}
        alt={artist.name}
        className="w-14 h-14 rounded-full object-cover ring-1 ring-border shrink-0"
        loading="lazy"
      />
    ) : (
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
        <Mic2 className="w-6 h-6 text-muted-foreground" aria-hidden />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground truncate">
          {artist.name}
        </p>
        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted">
          Nghệ sĩ
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {artist.totalFollowers !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {formatCount(artist.totalFollowers)} người theo dõi
          </span>
        )}
        {artist.monthlyListeners !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {formatCount(artist.monthlyListeners)} nghe/tháng
          </span>
        )}
      </div>
    </div>
  </div>
));
ArtistPreviewRow.displayName = "ArtistPreviewRow";

export interface ArtistSheetProps {
  artist?: IArtistDetail;
  isOpen: boolean;
  onClose: () => void;
  onOpenAddToPlaylistSheet?: (tracks: ITrack[]) => void;
}

export const ArtistSheet = memo(
  ({ artist, isOpen, onClose, onOpenAddToPlaylistSheet }: ArtistSheetProps) => {
    const dispatch = useAppDispatch();
    // Optimistic follow state (defensive typing — `IArtist` may not declare isFollowing)
    const isFollowing = useAppSelector(
      (state) => !!state.interaction.followedArtists[artist?._id ?? ""],
    );
    const { isThisArtistPlaying, togglePlayArtist, shuffleArtist } =
      useArtistPlayback(artist);
    const player = useAppSelector(selectPlayer);
    const { play } = usePlayCollection();
    const onArtistShare = (artist: IArtistDetail) => {
      navigator.share?.({
        title: (artist as IArtist).name,
        url: `/artists/${(artist as IArtist).slug}`,
      });
    };
    const onArtistAddToQueue = (artist: IArtistDetail) => {
      if (
        !("trackIds" in artist) ||
        !artist.trackIds ||
        artist.trackIds.length === 0
      ) {
        toast.error(`Không có bài nào để thêm vào hàng đợi`);
        return;
      }

      // If queue is empty -> directly play this genre (replace queue + start)
      if (!player.activeQueueIds || player.activeQueueIds.length === 0) {
        // Use play flow which will fetch detail, setQueue and start playback
        play({
          queryKey: artistKeys.detail(artist._id || artist.slug),
          fetchFn: () => artistApi.getArtistDetail(artist.slug),
          sourceType: "artist",
          startIndex: 0,
          collectionName: artist.name,
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

      const newIds = artist.trackIds.filter((id) => !existingSet.has(id));

      if (newIds.length === 0) {
        toast(`Tất cả bài của nghệ sĩ "${artist.name}" đã có trong hàng đợi`, {
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
      const dupCount = artist.trackIds.length - addedCount;
      if (dupCount > 0) {
        toast.success(
          `Đã thêm ${addedCount} bài vào hàng đợi — ${dupCount} bài đã có sẵn`,
        );
      } else {
        toast.success(
          `Đã thêm ${addedCount} bài của nghệ sĩ "${artist.name}" vào hàng đợi`,
        );
      }
    };
    const { handleToggle } = useInteraction();
    const actions = useMemo<ActionItem[]>(() => {
      if (!artist) return [];
      return [
        {
          icon: isFollowing ? UserCheck : UserPlus,
          label: isFollowing ? "Bỏ theo dõi" : "Theo dõi",
          variant: isFollowing ? "danger" : "default",
          onClick: () => {
            handleToggle(artist._id, "artist");
          },
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
            onArtistAddToQueue?.(artist);
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
              "trackIds" in artist &&
              artist.trackIds &&
              artist.trackIds.length > 0
            ) {
              const tracks = artist.trackIds.map(
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
            onArtistShare?.(artist);
            onClose();
          },
        },
      ];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      artist?._id,
      isFollowing,
      handleToggle,
      onOpenAddToPlaylistSheet,
      onClose,
    ]);

    // NOTE: removed globalThis-based syncing (caused side-effects and extra
    // writes). Rely on React state/selectors for follow status updates instead.

    return (
      <>
        <AnimatePresence>
          {isOpen && artist && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && artist && (
            <SheetWrapper
              key="wrapper"
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
          )}
        </AnimatePresence>
      </>
    );
  },
);
ArtistSheet.displayName = "ArtistSheet";
