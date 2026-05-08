import { ITrack } from "@/features/track/types";
import { TrackEditFormValues } from "../schemas/track.schema";

export const TRACK_DEFAULT_VALUES: TrackEditFormValues = {
  title: "",
  description: "",
  artistId: "",
  featuringArtistIds: [],
  albumId: null,
  genreIds: [],
  // --- NEW FIELDS v2.0 ---
  moodVideoId: null,
  lyricType: "none",
  plainLyrics: "",
  tags: [],
  // -----------------------
  releaseDate: new Date().toISOString().split("T")[0],
  isExplicit: false,
  isPublic: true,
  trackNumber: 1,
  diskNumber: 1,
  copyright: "",
  isrc: "",
  audio: null,
  coverImage: null,
};

export const mapTrackToForm = (track?: ITrack | null): TrackEditFormValues => {
  if (!track) return TRACK_DEFAULT_VALUES;

  // Helper trích xuất ID từ Object (nếu đã populate) hoặc lấy string
  const getId = (val: any) =>
    val && typeof val === "object" ? val._id : val || null;

  return {
    ...TRACK_DEFAULT_VALUES,
    title: track.title,
    description: track.description || "",
    artistId: getId(track.artist),
    featuringArtistIds: Array.isArray(track.featuringArtists)
      ? track.featuringArtists.map(getId)
      : [],
    genreIds: Array.isArray(track.genres) ? track.genres.map(getId) : [],
    albumId: getId(track.album),

    // Mapping MoodVideo & Lyrics
    moodVideoId: getId(track.moodVideo),
    lyricType: track.lyricType || "none",
    plainLyrics: track.plainLyrics || "",
    tags: track.tags || [],

    releaseDate: track.releaseDate
      ? new Date(track.releaseDate).toISOString().split("T")[0]
      : TRACK_DEFAULT_VALUES.releaseDate,
    isExplicit: track.isExplicit,
    isPublic: track.isPublic,
    trackNumber: track.trackNumber || 1,
    diskNumber: track.diskNumber || 1,
    copyright: track.copyright || "",
    isrc: track.isrc || "",
    audio: track.trackUrl, // Giữ URL để preview
    coverImage: track.coverImage,
  };
};
