// Pure playback clock and queue choice for music rooms.
// Server time is the source of truth. Client currentTime is not.

export interface PlaybackClock {
  currentTrackId: string | null;
  startedAt: number | null;
  isPaused: boolean;
  pausedAt: number;
  endsAt: number | null;
}

export interface QueueCandidate {
  trackId: string;
  addedBy: string;
  votes: number;
}

export interface PlayLockRedis {
  set: (
    key: string,
    value: string,
    expiryMode: "EX",
    ttlSeconds: number,
    condition: "NX",
  ) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

export const ROOM_PLAY_LOCK_TTL_SECONDS = 8;

export const roomPlayLockKey = (roomCode: string) => `lock:roomPlay:${roomCode}`;

export const pausePosition = (nowMs: number, startedAtMs: number | null): number => {
  if (!startedAtMs) return 0;
  return Math.max(0, (nowMs - startedAtMs) / 1000);
};

export const resumeStartedAt = (nowMs: number, pausedAtSeconds: number): number => {
  return nowMs - Math.max(0, pausedAtSeconds) * 1000;
};

export const endsAtFrom = (startedAtMs: number, durationSeconds: number): number | null => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return startedAtMs + Math.round(durationSeconds * 1000);
};

export const stampServerNow = <T extends object>(state: T, nowMs = Date.now()) => ({
  ...state,
  serverNow: nowMs,
});

/**
 * Highest votes win. If that track was added by the person who just played,
 * and someone else is still in the queue, play their highest-voted track.
 */
export const pickNextQueueItem = <T extends QueueCandidate>(
  queue: readonly T[],
  lastPlayedBy: string | null,
): T | null => {
  if (queue.length === 0) return null;
  const sorted = [...queue].sort((a, b) => b.votes - a.votes);
  const top = sorted[0];
  if (!lastPlayedBy || top.addedBy !== lastPlayedBy) return top;
  const other = sorted.find((item) => item.addedBy !== lastPlayedBy);
  return other ?? top;
};

export const acquireRoomPlayLock = async (
  redis: PlayLockRedis,
  roomCode: string,
): Promise<boolean> => {
  const result = await redis.set(
    roomPlayLockKey(roomCode),
    "1",
    "EX",
    ROOM_PLAY_LOCK_TTL_SECONDS,
    "NX",
  );
  return result === "OK";
};

export const releaseRoomPlayLock = async (redis: PlayLockRedis, roomCode: string) => {
  await redis.del(roomPlayLockKey(roomCode));
};
