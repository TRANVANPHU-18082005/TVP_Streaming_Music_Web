/**
 * Track.playCount is the lifetime listen counter.
 * cron/sync-views.ts is the only writer: it $incs from Redis views:track:*.
 * PlayLog is a 30-day audit log (TTL 2592000 seconds) and is not written
 * back onto this field. KaraokeRecording.playCount is a different counter.
 */

export function lifetimePlayCountSort(): { playCount: -1 } {
  return { playCount: -1 };
}

export function lifetimePlayCountWithReleaseSort(): {
  playCount: -1;
  releaseDate: -1;
} {
  return { playCount: -1, releaseDate: -1 };
}

/** Chart documents expose lifetime Track.playCount next to the PlayLog window score. */
export function lifetimePlayCountProjection(): "$track.playCount" {
  return "$track.playCount";
}
