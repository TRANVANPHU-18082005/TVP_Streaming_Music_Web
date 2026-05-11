import { useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  upsertMetadataCache,
  setLoadingState,
} from "@/features/player/slice/playerSlice";
import trackApi from "@/features/track/api/trackApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500; // exponential back-off: 500 → 1000 → 2000 ms

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Exponential back-off delay. Jitter (±20 %) prevents thundering herd when
 * multiple instances retry simultaneously.
 */
function getRetryDelay(attempt: number): number {
  const base = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTrackMetadataResolver
 *
 * Responsibilities:
 *  1. Fetch full metadata for `currentTrackId` when a cache miss occurs
 *     while loadingState === "loading".
 *  2. Silently preload metadata for `nextTrackId` in the background.
 *
 * Guarantees:
 *  - No duplicate in-flight requests for the same track ID.
 *  - HTTP requests are hard-cancelled (AbortController) on cleanup, not just
 *    "result ignored" — prevents stale writes and wasted bandwidth.
 *  - Exponential back-off retry (up to MAX_RETRY_ATTEMPTS) for transient
 *    network errors on the current track. Preload failures are silent.
 *  - fetchingRef tracks *real* in-flight requests; it is only cleared once
 *    the AbortController settles (success, error, or abort), never on cancel.
 *  - cacheRef / loadingStateRef break dependency-array cycles without
 *    causing stale-closure bugs.
 */
export function useTrackMetadataResolver(): void {
  const dispatch = useAppDispatch();

  const currentTrackId = useAppSelector((s) => s.player.currentTrackId);
  const nextTrackId = useAppSelector((s) => s.player.nextTrackIdPreloaded);
  const loadingState = useAppSelector((s) => s.player.loadingState);

  // Refs for values we need to *read* inside async callbacks without
  // re-triggering effects or causing stale closure bugs.
  const cache = useAppSelector((s) => s.player.trackMetadataCache);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const loadingStateRef = useRef(loadingState);
  loadingStateRef.current = loadingState;

  /**
   * Tracks IDs that have an active HTTP request.
   * Key: trackId  Value: AbortController for that request
   */
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());

  // ── Core fetch with retry ──────────────────────────────────────────────────

  /**
   * Fetches track metadata with exponential back-off retry.
   *
   * @param trackId       Track to fetch.
   * @param signal        AbortSignal bound to the caller's AbortController.
   * @param isCritical    When true, dispatches setLoadingState("idle") on
   *                      permanent failure so the player doesn't hang.
   */
  const fetchWithRetry = useCallback(
    async (
      trackId: string,
      signal: AbortSignal,
      isCritical: boolean,
    ): Promise<void> => {
      let lastError: unknown;

      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        // Abort or cache hit → bail out early
        if (signal.aborted) return;
        if (cacheRef.current[trackId]) return;

        try {
          const track = await trackApi.getTrackDetail(trackId, { signal });

          // After await, re-check abort to avoid a dispatch on a stale request
          if (signal.aborted) return;

          dispatch(upsertMetadataCache([track.data ?? track]));
          return; // success — exit retry loop
        } catch (err) {
          if (isAbortError(err)) return; // intentional cancel — stop silently

          lastError = err;

          const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS;
          if (isLastAttempt) break;

          // Wait before next attempt — but abort if cancelled in the meantime
          const delay = getRetryDelay(attempt);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            });
          }).catch((err) => {
            if (isAbortError(err)) return;
            throw err;
          });

          if (signal.aborted) return;
        }
      }

      // All retries exhausted
      if (isCritical && !signal.aborted) {
        console.error(
          `[TrackMetadataResolver] Failed to load track "${trackId}" after ${MAX_RETRY_ATTEMPTS} attempts:`,
          lastError,
        );
        // Only reset loadingState if it's still "loading" — don't clobber a
        // state transition that happened while we were retrying.
        if (loadingStateRef.current === "loading") {
          dispatch(setLoadingState("idle"));
        }
      }
    },
    [dispatch],
  );

  // ── Effect: fetch current track ────────────────────────────────────────────

  useEffect(() => {
    if (!currentTrackId) return;
    if (cacheRef.current[currentTrackId]) return;

    // If there's already a live request for this ID, don't duplicate it.
    if (inFlightRef.current.has(currentTrackId)) return;

    const controller = new AbortController();
    inFlightRef.current.set(currentTrackId, controller);

    // Treat the fetch as "critical" only when the player explicitly marked
    // the state as "loading". Otherwise fetch in background without forcing
    // UI state transitions on permanent failure.
    const isCritical = loadingState === "loading";

    fetchWithRetry(currentTrackId, controller.signal, isCritical)
      .catch((err) => {
        if (!isAbortError(err)) {
          console.error("[TrackMetadataResolver] Unexpected error:", err);
        }
      })
      .finally(() => {
        if (inFlightRef.current.get(currentTrackId) === controller) {
          inFlightRef.current.delete(currentTrackId);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentTrackId, loadingState, fetchWithRetry]);

  // ── Effect: silently preload next track ────────────────────────────────────

  useEffect(() => {
    if (!nextTrackId) return;
    if (cacheRef.current[nextTrackId]) return;
    if (inFlightRef.current.has(nextTrackId)) return;

    const controller = new AbortController();
    inFlightRef.current.set(nextTrackId, controller);

    fetchWithRetry(nextTrackId, controller.signal, /* isCritical */ false)
      .catch((err) => {
        if (!isAbortError(err)) {
          console.warn(
            `[TrackMetadataResolver] Preload failed for track "${nextTrackId}":`,
            err,
          );
        }
      })
      .finally(() => {
        if (inFlightRef.current.get(nextTrackId) === controller) {
          inFlightRef.current.delete(nextTrackId);
        }
      });

    return () => {
      controller.abort();
    };
  }, [nextTrackId, fetchWithRetry]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Abort every in-flight request when the hook owner unmounts.
      inFlightRef.current.forEach((controller) => controller.abort());
      inFlightRef.current.clear();
    };
  }, []);
}
