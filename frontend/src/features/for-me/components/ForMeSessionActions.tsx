import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import playlistApi from "@/features/playlist/api/playlistApi";
import { playlistKeys } from "@/features/playlist/utils/playlistKeys";
import trackApi from "@/features/track/api/trackApi";
import { addToQueue, getMyRoom } from "@/features/music-room/api/room.api";
import { useAppSelector } from "@/store/hooks";
import { CLIENT_PATHS } from "@/config/paths";
import { handleError } from "@/utils/handleError";
import type { ITrack } from "@/features/track/types";

interface ForMeSessionActionsProps {
  track: ITrack;
  trackIds: string[];
  onAppend: (tracks: ITrack[]) => void;
}

export const ForMeSessionActions = ({ track, trackIds, onAppend }: ForMeSessionActionsProps) => {
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"save" | "similar" | "room" | null>(null);
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
  };

  return (
    <div className="pointer-events-auto absolute bottom-20 left-3 z-30 flex max-w-[calc(100%-5.5rem)] gap-2 overflow-x-auto lg:bottom-6 lg:left-auto lg:right-[21rem]">
      <Action label="Lưu phiên" disabled={busy !== null} onClick={() => { void saveSession(); }} />
      <Action label="Nghệ sĩ này" disabled={busy !== null} onClick={() => { void moreFromArtist(); }} />
      <Action label="Vào phòng" disabled={busy !== null} onClick={() => { void addToRoom(); }} />
      {track.lyricType === "karaoke" ? (
        <Action label="Karaoke" disabled={busy !== null} onClick={openKaraoke} />
      ) : null}
    </div>
  );
};

const Action = ({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="shrink-0 rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[11px] text-white backdrop-blur-md disabled:opacity-50"
  >
    {label}
  </button>
);
