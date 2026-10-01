import { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import trackApi from "@/features/track/api/trackApi";
import type { ITrack } from "@/features/track";
import { upsertMetadataCache } from "../slice/playerSlice";

/**
 * List responses omit plainLyrics. Load them only when the lyrics view is open.
 */
export function usePlainLyrics(
  track: ITrack | null | undefined,
  enabled: boolean,
): string | undefined {
  const dispatch = useAppDispatch();
  const [loaded, setLoaded] = useState(track?.plainLyrics);

  useEffect(() => {
    setLoaded(track?.plainLyrics);
  }, [track?._id, track?.plainLyrics]);

  useEffect(() => {
    if (!enabled || !track?._id || track.lyricType !== "plain" || loaded?.trim()) {
      return;
    }

    const controller = new AbortController();
    trackApi
      .getTrackDetail(track._id, { signal: controller.signal })
      .then((res) => {
        const full = res.data;
        if (!full) return;
        if (full.plainLyrics) setLoaded(full.plainLyrics);
        dispatch(upsertMetadataCache([full]));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [dispatch, enabled, loaded, track?._id, track?.lyricType]);

  return loaded ?? track?.plainLyrics;
}
