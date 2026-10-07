import { useState, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Share2, Disc3, Mic2, PlusCircle, Users, MoreHorizontal, Coffee, Heart, Captions } from "lucide-react";
import { AnimatePresence } from "framer-motion";

import playlistApi from "@/features/playlist/api/playlistApi";
import { playlistKeys } from "@/features/playlist/utils/playlistKeys";
import trackApi from "@/features/track/api/trackApi";
import { addToQueue, getMyRoom } from "@/features/music-room/api/room.api";
import { useAppSelector } from "@/store/hooks";
import { CLIENT_PATHS } from "@/config/paths";
import { handleError } from "@/utils/handleError";
import { buildShareUrl, shareOrCopy } from "@/utils/share";
import { useInteraction } from "@/features/interaction/hooks/useInteraction";
import { selectIsInteracted } from "@/features/interaction/slice/interactionSlice";
import type { ITrack } from "@/features/track/types";
import { useContextSheet } from "@/app/provider/SheetProvider";
import {
  ActionButton,
  ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "@/app/context/sheetPrimitives";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Music2 } from "lucide-react";

const TrackPreviewRow = memo(({ track }: { track: ITrack }) => {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
      {track.coverImage ? (
        <ImageWithFallback
          src={track.coverImage}
          alt={track.title}
          className="w-14 h-14 rounded-xl object-cover ring-1 ring-border shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
          <Music2 className="w-6 h-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {typeof track.artist === "object" ? track.artist?.name : ""}
        </p>
      </div>
    </div>
  );
});
TrackPreviewRow.displayName = "TrackPreviewRow";

interface ForMeSheetProps {
  track: ITrack;
  trackIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onAppend: (tracks: ITrack[]) => void;
  onDismiss: () => void;
  onToggleRelaxMode?: () => void;
  onToggleLyrics?: () => void;
  lyricsOpen?: boolean;
  relaxMode?: boolean;
}

export const ForMeSheet = memo(({ track, trackIds, isOpen, onClose, onAppend, onDismiss, onToggleRelaxMode, onToggleLyrics, lyricsOpen, relaxMode }: ForMeSheetProps) => {
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openTrackSheet } = useContextSheet();
  const [, setBusy] = useState<"save" | "similar" | "room" | null>(null);
  const { handleToggle } = useInteraction();
  const isLiked = useAppSelector((state) => selectIsInteracted(state, track._id, "track"));
  const isPending = useAppSelector((state) => Boolean(state.interaction.loadingIds[`track:${track._id}`]));
  
  const artistName = typeof track.artist === "object" ? track.artist?.name : undefined;

  const saveSession = async () => {
    if (!user) {
      toast("Đăng nhập để lưu phiên nghe.");
      return;
    }
    const ids = trackIds.slice(0, 50);
    if (ids.length === 0) return;
    setBusy("save");
    try {
      const created = await playlistApi.createQuickPlaylist({
        title: "Dành cho tôi",
        visibility: "private",
      });
      await playlistApi.addTracks(created.data._id, ids);
      void queryClient.invalidateQueries({ queryKey: playlistKeys.myList() });
      toast.success("Đã lưu phiên vào playlist.");
      onClose();
    } catch (error) {
      handleError(error, "Không lưu được phiên nghe.");
    } finally {
      setBusy(null);
    }
  };

  const moreFromArtist = async () => {
    setBusy("similar");
    try {
      const result = await trackApi.getSimilarTracks(track._id, 8);
      const next = (result.tracks ?? []).filter((item) => !trackIds.includes(item._id));
      if (next.length === 0) {
        toast("Không có thêm bài cùng nghệ sĩ.");
        return;
      }
      onAppend(next);
      toast.success(artistName ? `Đã thêm bài của ${artistName}.` : "Đã thêm bài cùng nghệ sĩ.");
      onClose();
    } catch (error) {
      handleError(error, "Không tải được bài cùng nghệ sĩ.");
    } finally {
      setBusy(null);
    }
  };

  const addToRoom = async () => {
    if (!user) {
      toast("Đăng nhập để thêm vào phòng nghe.");
      return;
    }
    setBusy("room");
    try {
      const room = await getMyRoom();
      if (!room?.roomCode) {
        toast("Bạn chưa có phòng nghe.");
        return;
      }
      await addToQueue(room.roomCode, track._id);
      toast.success("Đã thêm vào phòng nghe.");
      onClose();
    } catch (error) {
      handleError(error, "Không thêm được vào phòng nghe.");
    } finally {
      setBusy(null);
    }
  };

  const openKaraoke = () => {
    const query = [track.title, artistName].filter(Boolean).join(" ");
    const target = `/${CLIENT_PATHS.KARAOKE_STUDIO}?q=${encodeURIComponent(query)}`;
    navigate(user ? target : `/login?next=${encodeURIComponent(target)}`);
    onClose();
  };

  const handleShare = async () => {
    await shareOrCopy({
      title: track.title,
      text: `Nghe "${track.title}" trên TVP Music`,
      url: buildShareUrl(CLIENT_PATHS.TRACK_DETAIL(track._id || track.slug)),
    });
    onClose();
  };

  const actions = useMemo<ActionItem[]>(() => {
    const baseActions: ActionItem[] = [];

    if (onToggleRelaxMode) {
      baseActions.push({
        icon: Coffee,
        label: relaxMode ? "Tắt chế độ thư giãn" : "Bật chế độ thư giãn",
        onClick: () => {
          onToggleRelaxMode();
          onClose();
        },
      });
    }

    baseActions.push({
      icon: Heart,
      label: isLiked ? "Bỏ thích bài hát" : "Thích bài hát",
      variant: isLiked ? "active" : "default",
      onClick: () => {
        if (!isPending) handleToggle(track._id, "track");
      },
    });

    if (onToggleLyrics) {
      baseActions.push({
        icon: Captions,
        label: lyricsOpen ? "Ẩn lời bài hát" : "Hiện lời bài hát",
        onClick: () => {
          onToggleLyrics();
          onClose();
        },
      });
    }

    baseActions.push(
      {
        icon: PlusCircle,
        label: "Lưu phiên nghe vào playlist",
        onClick: () => { void saveSession(); },
      },
      {
        icon: Users,
        label: "Phát thêm bài từ nghệ sĩ này",
        onClick: () => { void moreFromArtist(); },
      },
      {
        icon: Disc3,
        label: "Thêm vào phòng nghe chung",
        onClick: () => { void addToRoom(); },
      }
    );

    if (track.lyricType === "karaoke") {
      baseActions.push({
        icon: Mic2,
        label: "Hát Karaoke",
        onClick: openKaraoke,
      });
    }

    baseActions.push(
      {
        icon: Share2,
        label: "Chia sẻ bài hát",
        onClick: () => { void handleShare(); },
      },
      {
        icon: Ban,
        label: "Không quan tâm bài này",
        variant: "danger",
        onClick: () => {
          onDismiss();
          onClose();
        },
      },
      {
        icon: MoreHorizontal,
        label: "Tuỳ chọn cơ bản khác...",
        onClick: () => {
          onClose();
          setTimeout(() => {
            openTrackSheet(track);
          }, 220); // wait for exit animation
        },
      }
    );

    return baseActions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, trackIds, onAppend, onDismiss, onClose, openTrackSheet, onToggleRelaxMode, relaxMode, isLiked, isPending, handleToggle, onToggleLyrics, lyricsOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <SheetWrapper
            key="wrapper"
            ariaLabel="Tùy chọn cho phiên nghe"
            zIndex={91}
            onClose={onClose}
          >
            <HandleBar />
            <TrackPreviewRow track={track} />
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
});
ForMeSheet.displayName = "ForMeSheet";
