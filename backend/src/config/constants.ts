export const APP_CONFIG = {
  SELECTOR_LIMIT: 7,
  VIRTUAL_SCROLL_LIMIT: 20,
  TRACKS_LIMIT: 500,
  PAGINATION_LIMIT: 7,
  HOME_PAGE_LIMIT: 7,
  GRID_LIMIT: 6,
  UPLOAD_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  API_TIMEOUT: 10000,
  MAX_PAGES: 100, // Giới hạn max page để tránh ReDoS
} as const;
export const TRACK_SELECT =
  "title slug artist featuringArtists album genres coverImage duration lyricUrl bitrate description" +
  "hlsUrl lyricType isExplicit playCount releaseDate moodVideo plainLyrics lyricPreview likeCount";
export const TRACK_POPULATE = [
  { path: "artist", select: "name avatar slug" },
  { path: "featuringArtists", select: "name slug avatar" },
  { path: "album", select: "title coverImage slug" },
  { path: "genres", select: "name slug" },
  {
    path: "moodVideo",
    select: "videoUrl loop thumbnailUrl",
    model: "TrackMoodVideo",
  },
] as const;
