/**
 * useCollectionPlayback — Generic hook
 *
 * Shared logic cho tất cả collection types (album, artist, genre, playlist).
 * Không dùng trực tiếp, được wrap bởi các hook cụ thể.
 *
 * Business rules (Spotify-style):
 *  - 1 play hợp lệ = nghe liên tục ≥ PLAY_THRESHOLD_MS (30s)
 *  - Session reset khi collectionId thay đổi
 *  - Pause giữa chừng → reset timer (không tích lũy thời gian)
 *  - Offline → queue vào memory → flush khi socket reconnect
 *  - Đúng 1 lần ghi nhận / session
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, selectPlayer } from "@/features/player";
import { usePlayCollection } from "./usePlayCollection";
import { useSocket } from "@/hooks";
import { env } from "@/config/env";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAY_THRESHOLD_MS = 30_000;
const SOCKET_EVENT = "interact_play" as const;

// ─── Offline Queue (module-level singleton) ───────────────────────────────────

interface PlayEvent {
  targetId: string;
  targetType: CollectionType;
  userId: string | undefined;
  queuedAt: number;
}

const pendingQueue: PlayEvent[] = [];

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollectionType = "album" | "artist" | "genre" | "playlist";

export interface CollectionPlaybackConfig {
  /** ID của collection */
  collectionId: string | undefined;
  /** Tên hiển thị (dùng cho log & toast) */
  collectionName: string | undefined;
  /** Type của collection */
  collectionType: CollectionType;
  /** queryKey cho React Query cache */
  queryKey: readonly unknown[];
  /** Hàm fetch data của collection */
  fetchFn: () => Promise<any>;
}

export interface CollectionPlaybackReturn {
  /** Toggle play/pause. Nếu chưa active → load & play từ index */
  togglePlay: (
    e?: React.MouseEvent | React.KeyboardEvent,
    index?: number,
  ) => void;
  /** Phát shuffle */
  shuffle: (e?: React.MouseEvent | React.KeyboardEvent) => void;
  /** Collection này có đang được load vào player không */
  isActive: boolean;
  /** Collection này có đang phát không */
  isPlaying: boolean;
  /** Đang fetch data */
  isFetching: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCollectionPlayback(
  config: CollectionPlaybackConfig,
): CollectionPlaybackReturn {
  const { collectionId, collectionName, collectionType, queryKey, fetchFn } =
    config;

  const dispatch = useAppDispatch();
  const { currentSource, isPlaying: globalIsPlaying } =
    useAppSelector(selectPlayer);
  const { user } = useAppSelector((state) => state.auth);
  const { play, isFetching } = usePlayCollection();
  const { socket, isConnected } = useSocket();

  // ── Session refs (không trigger re-render) ────────────────────────────────

  const hasRecordedRef = useRef(false);
  const thresholdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isActive = useMemo(() => {
    if (!collectionId || !currentSource?.id) return false;
    return (
      currentSource.id === collectionId && currentSource.type === collectionType
    );
  }, [currentSource?.id, currentSource?.type, collectionId, collectionType]);

  const isPlaying = isActive && globalIsPlaying;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const userId = user?._id ?? user?.id;

  const clearThresholdTimer = useCallback(() => {
    if (thresholdTimerRef.current !== null) {
      clearTimeout(thresholdTimerRef.current);
      thresholdTimerRef.current = null;
    }
  }, []);

  const emitOrQueue = useCallback(
    (event: PlayEvent) => {
      if (socket && isConnected) {
        socket.emit(SOCKET_EVENT, {
          targetId: event.targetId,
          targetType: event.targetType,
          userId: event.userId,
        });

        if (env.NODE_ENV === "development") {
          console.log(
            `[Analytics] ✅ Play emitted — ${event.targetType}: "${collectionName}"`,
          );
        }
      } else {
        pendingQueue.push(event);

        if (env.NODE_ENV === "development") {
          console.log(
            `[Analytics] 📦 Queued (offline) — ${event.targetType}: "${collectionName}". Queue: ${pendingQueue.length}`,
          );
        }
      }
    },
    [socket, isConnected, collectionName],
  );

  const startThresholdTimer = useCallback(
    (id: string) => {
      if (thresholdTimerRef.current !== null) return; // Đang đếm, không reset

      thresholdTimerRef.current = setTimeout(() => {
        thresholdTimerRef.current = null;

        if (hasRecordedRef.current) return; // Race guard

        hasRecordedRef.current = true;

        emitOrQueue({
          targetId: id,
          targetType: collectionType,
          userId,
          queuedAt: Date.now(),
        });
      }, PLAY_THRESHOLD_MS);
    },
    [emitOrQueue, collectionType, userId],
  );

  // ── Effect 1: Reset session khi đổi collection ────────────────────────────

  useEffect(() => {
    hasRecordedRef.current = false;
    clearThresholdTimer();
  }, [collectionId, clearThresholdTimer]);

  // ── Effect 2: Điều phối timer theo trạng thái play/pause ─────────────────

  useEffect(() => {
    if (!collectionId) return;

    const shouldCount = isActive && globalIsPlaying && !hasRecordedRef.current;

    if (shouldCount) {
      startThresholdTimer(collectionId);
    } else {
      // Pause → dừng timer (reset, không tích lũy — Spotify model)
      clearThresholdTimer();
    }
  }, [
    isActive,
    globalIsPlaying,
    collectionId,
    startThresholdTimer,
    clearThresholdTimer,
  ]);

  // ── Effect 3: Flush offline queue khi reconnect ───────────────────────────

  useEffect(() => {
    if (!socket || !isConnected || pendingQueue.length === 0) return;

    const toFlush = pendingQueue.splice(0, pendingQueue.length);
    toFlush.forEach((event) => {
      socket.emit(SOCKET_EVENT, {
        targetId: event.targetId,
        targetType: event.targetType,
        userId: event.userId,
      });
    });

    if (env.NODE_ENV === "development") {
      console.log(`[Analytics] 🚀 Flushed ${toFlush.length} queued play(s)`);
    }
  }, [socket, isConnected]);

  // ── Cleanup khi unmount ───────────────────────────────────────────────────

  useEffect(() => () => clearThresholdTimer(), [clearThresholdTimer]);

  // ── Playback Controls ─────────────────────────────────────────────────────

  const togglePlay = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent, index = 0) => {
      e?.stopPropagation();
      if (!collectionId) return;

      if (isActive) {
        dispatch(setIsPlaying(!globalIsPlaying));
      } else {
        play({
          queryKey,
          fetchFn,
          sourceType: collectionType,
          startIndex: index,
          collectionName,
          shuffle: false,
        });
      }
    },
    [
      isActive,
      globalIsPlaying,
      collectionId,
      collectionName,
      collectionType,
      queryKey,
      fetchFn,
      play,
      dispatch,
    ],
  );

  const shuffle = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (!collectionId) return;

      play({
        queryKey,
        fetchFn,
        sourceType: collectionType,
        startIndex: -1,
        collectionName,
        shuffle: true,
      });
    },
    [collectionId, collectionName, collectionType, queryKey, fetchFn, play],
  );

  return { togglePlay, shuffle, isActive, isPlaying, isFetching };
}
