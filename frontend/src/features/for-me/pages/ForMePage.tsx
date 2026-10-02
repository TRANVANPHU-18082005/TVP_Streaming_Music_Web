import { useCallback, useEffect, useRef, useState, type TouchEvent, type WheelEvent } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Sparkles } from "lucide-react";
import { FeedItem } from "../components/FeedItem";
import { ForMeGenrePicker } from "../components/ForMeGenrePicker";
import { ForMeEndShelf } from "../components/ForMeEndShelf";
import { ForMeSessionActions } from "../components/ForMeSessionActions";
import { ForMeHeader } from "../components/ForMeHeader";
import { ForMeSessionBar, type ForMeMood } from "../components/ForMeSessionBar";
import { useForMeFeed } from "../hooks/useForMeFeed";
import {
  appendQueueIds,
  jumpToIndex,
  nextTrack,
  prevTrack,
  removeFromQueue,
  selectPlayer,
  setIsPlaying,
  setQueue,
  upsertMetadataCache,
} from "@/features/player/slice/playerSlice";
import { recommendationApi } from "../api/recommendationApi";
import { CLIENT_PATHS, AUTH_PATHS } from "@/config/paths";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";
import { useAppSelector } from "@/store/hooks";
import { useQueryClient } from "@tanstack/react-query";
import type { ITrack } from "@/features/track/types";

const SESSION_LIMIT = 10;

function mergeTracks(current: ITrack[], incoming: ITrack[]): ITrack[] {
  const known = new Set(current.map((track) => track._id));
  const fresh = incoming.filter((track) => !known.has(track._id));
  return fresh.length > 0 ? [...current, ...fresh] : current;
}

function playedRatio(): number {
  const audio = document.getElementById("global-audio-player") as HTMLAudioElement | null;
  if (!audio?.duration || !Number.isFinite(audio.duration)) return 1;
  return audio.currentTime / audio.duration;
}

const TASTE_SKIP_KEY = "tvp-for-me-taste-skip";

export const ForMePage = () => {
  const [mix, setMix] = useState<number | undefined>(undefined);
  const [mood, setMood] = useState<ForMeMood | null>(null);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [tasteSkipped, setTasteSkipped] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(TASTE_SKIP_KEY) === "1",
  );
  const [refreshing, setRefreshing] = useState(false);
  const replaceQueue = useRef(false);
  const tasteKey = `${mix ?? "default"}|${mood ?? ""}|${genreIds.join(",")}`;
  const seenTaste = useRef(tasteKey);
  const { data, isLoading, isError, refetch, isFetching } = useForMeFeed(SESSION_LIMIT, {
    mix,
    mood: mood ?? undefined,
    genreIds,
  });
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);
  const user = useAppSelector((state) => state.auth.user);
  const [sessionTracks, setSessionTracks] = useState<ITrack[] | null>(null);
  const tracks = sessionTracks ?? data?.data?.tracks ?? [];
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const loadingMore = useRef(false);
  const exhausted = useRef(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [lyricsOpen, setLyricsOpen] = useState(false);
  const lyricsOpenRef = useRef(false);
  lyricsOpenRef.current = lyricsOpen;
  const gestureLock = useRef(false);
  const touchStartY = useRef<number | null>(null);

  const incoming = data?.data?.tracks;
  const trackKey = tracks.map((track) => track._id).join(",");
  const queueKey = player.originalQueueIds.join(",");
  const sourceIsForMe = player.currentSource?.id === CLIENT_PATHS.FOR_ME;
  const showPicker = Boolean(data?.data?.meta?.needsTaste) && !tasteSkipped && genreIds.length === 0;
  const showPickerRef = useRef(false);
  showPickerRef.current = showPicker;

  useEffect(() => {
    if (seenTaste.current === tasteKey) return;
    seenTaste.current = tasteKey;
    replaceQueue.current = true;
    exhausted.current = false;
    setSessionEnded(false);
    setSessionTracks(null);
  }, [tasteKey]);

  useEffect(() => {
    if (!incoming?.length) return;
    setSessionTracks((current) => current === null ? incoming : mergeTracks(current, incoming));
  }, [incoming]);

  useEffect(() => {
    if (!trackKey || showPicker) return;
    const currentTracks = tracksRef.current;
    if (replaceQueue.current) {
      replaceQueue.current = false;
      dispatch(setQueue({
        trackIds: currentTracks.map((track) => track._id),
        initialMetadata: currentTracks,
        startIndex: 0,
        source: { id: CLIENT_PATHS.FOR_ME, type: "suggestions", title: "Dành cho tôi" },
      }));
      return;
    }
    if (sourceIsForMe && player.originalQueueIds.length > 0) {
      const known = new Set(player.originalQueueIds);
      const fresh = currentTracks.filter((track) => !known.has(track._id));
      if (fresh.length > 0) {
        dispatch(appendQueueIds(fresh.map((track) => track._id)));
      }
      dispatch(upsertMetadataCache(currentTracks));
      return;
    }
    dispatch(setQueue({
      trackIds: currentTracks.map((track) => track._id),
      initialMetadata: currentTracks,
      startIndex: 0,
      source: { id: CLIENT_PATHS.FOR_ME, type: "suggestions", title: "Dành cho tôi" },
    }));
  }, [dispatch, player.originalQueueIds, queueKey, showPicker, sourceIsForMe, trackKey]);

  useEffect(() => {
    const queueLength = sourceIsForMe ? player.activeQueueIds.length : 0;
    const nearEnd = queueLength > 0 && player.currentIndex >= queueLength - 2;
    if (showPicker || !sourceIsForMe || !nearEnd) return;
    if (loadingMore.current || exhausted.current) return;
    loadingMore.current = true;
    const excludeIds = tracksRef.current.map((track) => track._id);
    void recommendationApi.getForMeFeed(SESSION_LIMIT, {
      session: true,
      excludeIds,
      mix,
      mood: mood ?? undefined,
      genreIds,
    })
      .then((response) => {
        const next = (response.data?.tracks ?? []).filter((track) => !excludeIds.includes(track._id));
        if (next.length === 0) {
          exhausted.current = true;
          setSessionEnded(true);
          return;
        }
        setSessionTracks((current) => mergeTracks(current ?? tracksRef.current, next));
      })
      .catch(() => undefined)
      .finally(() => {
        loadingMore.current = false;
      });
  }, [genreIds, mix, mood, player.activeQueueIds.length, player.currentIndex, showPicker, sourceIsForMe]);

  const queueIds = sourceIsForMe && player.activeQueueIds.length > 0
    ? player.activeQueueIds
    : tracks.map((track) => track._id);
  const index = sourceIsForMe
    ? Math.min(Math.max(player.currentIndex, 0), Math.max(queueIds.length - 1, 0))
    : 0;
  const trackById = new Map(tracks.map((track) => [track._id, track]));
  const currentId = queueIds[index];
  const queued = currentId
    ? trackById.get(currentId) ?? player.trackMetadataCache[currentId]
    : undefined;
  const current = queued ?? tracks[0];
  const atEnd = queueIds.length > 0 && index >= queueIds.length - 1;

  useEffect(() => {
    setLyricsOpen(false);
  }, [current?._id]);

  const refreshTaste = useCallback(() => {
    setRefreshing(true);
    replaceQueue.current = true;
    exhausted.current = false;
    setSessionEnded(false);
    setSessionTracks(null);
    void recommendationApi.refreshSession()
      .catch(() => undefined)
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: ["for-me-feed"] }).finally(() => {
          setRefreshing(false);
        });
      });
  }, [queryClient]);

  const skipTaste = useCallback(() => {
    sessionStorage.setItem(TASTE_SKIP_KEY, "1");
    setTasteSkipped(true);
  }, []);

  const go = useCallback((direction: 1 | -1) => {
    if (gestureLock.current || showPickerRef.current) return;
    gestureLock.current = true;
    if (direction > 0) {
      if (player.currentTrackId && playedRatio() < 0.3) {
        void recommendationApi.sendFeedback(player.currentTrackId, "skip").catch(() => undefined);
      }
      dispatch(nextTrack());
    } else {
      dispatch(prevTrack(0));
    }
    window.setTimeout(() => {
      gestureLock.current = false;
    }, 450);
  }, [dispatch, player.currentTrackId]);

  const dismissCurrent = useCallback(() => {
    const id = player.currentTrackId;
    if (!id) return;
    void recommendationApi.sendFeedback(id, "dismiss").catch(() => undefined);
    dispatch(nextTrack());
    dispatch(removeFromQueue(id));
    setSessionTracks((current) => (current ?? tracksRef.current).filter((track) => track._id !== id));
  }, [dispatch, player.currentTrackId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        go(-1);
      } else if (event.key === " ") {
        event.preventDefault();
        dispatch(setIsPlaying(!player.isPlaying));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, go, player.isPlaying]);

  const onWheel = (event: WheelEvent) => {
    if (lyricsOpenRef.current && (event.target as HTMLElement).closest("[data-lyrics]")) return;
    if (Math.abs(event.deltaY) < 40) return;
    go(event.deltaY > 0 ? 1 : -1);
  };

  const onTouchStart = (event: TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartY.current == null) return;
    if (lyricsOpenRef.current && (event.target as HTMLElement).closest("[data-lyrics]")) return;
    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
    const delta = touchStartY.current - endY;
    touchStartY.current = null;
    if (Math.abs(delta) < 48) return;
    go(delta > 0 ? 1 : -1);
  };

  if (isLoading || (!data && !isError)) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black">
        <ForMeHeader />
        <PremiumMusicVisualizer active />
        <p className="text-sm text-white/80">Đang tải đề xuất của bạn...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <ForMeHeader />
        <Sparkles className="h-10 w-10 text-white/30" />
        <p className="text-base text-white/80">Không tải được đề xuất.</p>
        <button
          type="button"
          onClick={() => { void refetch(); }}
          disabled={isFetching}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (showPicker) {
    return (
      <div className="relative h-dvh w-full overflow-hidden bg-black">
        <ForMeHeader />
        <ForMeGenrePicker
          onSkip={skipTaste}
          onConfirm={(ids) => setGenreIds(ids)}
        />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <ForMeHeader />
        <Sparkles className="h-10 w-10 text-white/30" />
        <p className="text-base text-white/80">Chưa có bài hát phù hợp.</p>
        <Link to={CLIENT_PATHS.HOME} className="text-sm font-semibold text-white underline">
          Về trang chủ
        </Link>
      </div>
    );
  }

  const upcoming = queueIds.slice(index + 1, index + 9).map((id, offset) => ({
    id,
    queueIndex: index + 1 + offset,
    track: trackById.get(id) ?? player.trackMetadataCache[id],
  }));
  const neighbors = [queueIds[index - 1], queueIds[index + 1]]
    .map((id) => (id ? trackById.get(id) ?? player.trackMetadataCache[id] : undefined))
    .filter((track): track is ITrack => Boolean(track?.coverImage));

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <ForMeHeader />
      <ForMeSessionBar
        mix={mix ?? 0.5}
        mood={mood}
        refreshing={refreshing}
        onMix={setMix}
        onMood={setMood}
        onRefresh={refreshTaste}
      />
      {!user && sourceIsForMe && index >= 4 && (
        <div className="absolute left-1/2 top-28 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs text-white backdrop-blur-md">
          <span>Đăng nhập để giữ gu nghe của bạn.</span>
          <Link to={AUTH_PATHS.LOGIN} className="font-semibold underline">
            Đăng nhập
          </Link>
        </div>
      )}
      <ForMeSessionActions
        track={current}
        trackIds={queueIds}
        onAppend={(next) => {
          dispatch(appendQueueIds(next.map((item) => item._id)));
          dispatch(upsertMetadataCache(next));
          setSessionTracks((existing) => mergeTracks(existing ?? tracksRef.current, next));
        }}
      />
      <div className="flex h-full">
        <div
          className="relative min-w-0 flex-1"
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {neighbors.map((track) => (
            <img key={track._id} src={track.coverImage} alt="" className="hidden" />
          ))}
          <FeedItem
            track={current}
            isPlaying={player.isPlaying && player.currentTrackId === current._id}
            lyricsOpen={lyricsOpen}
            onTogglePlay={() => dispatch(setIsPlaying(!(player.isPlaying && player.currentTrackId === current._id)))}
            onToggleLyrics={() => setLyricsOpen((open) => !open)}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
            onDismiss={dismissCurrent}
          />
        </div>
        <aside className="hidden w-80 shrink-0 flex-col border-l border-white/10 bg-black/50 pt-16 lg:flex">
          <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            Tiếp theo
          </p>
          {upcoming.length === 0 ? (
            <p className="px-4 text-sm text-white/50">
              {sessionEnded ? "Hết phiên này." : "Hết danh sách phiên này."}
            </p>
          ) : (
            <ol className="flex-1 space-y-1 overflow-y-auto px-2 pb-6">
              {upcoming.map(({ id, queueIndex, track }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => dispatch(jumpToIndex(queueIndex))}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/10"
                  >
                    <img
                      src={track?.coverImage}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {track?.title ?? "Bài hát"}
                      </span>
                      <span className="block truncate text-xs text-white/60">
                        {track?.reason ?? "Trong phiên này"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {sessionEnded ? <ForMeEndShelf /> : null}
        </aside>
      </div>
      {sessionEnded && atEnd ? (
        <div className="absolute inset-x-0 bottom-16 z-30 max-h-[38vh] overflow-y-auto bg-black/85 lg:hidden">
          <ForMeEndShelf />
        </div>
      ) : null}
    </div>
  );
};
