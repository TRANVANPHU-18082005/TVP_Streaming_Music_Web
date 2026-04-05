import mongoose, { Schema, Document } from "mongoose";

// Interface cho Lyric Line Metadata (Chỉ lưu text thô để search & preview nhanh)
interface ILyricPreview {
  startTime: number;
  text: string;
}

export interface ITrack extends Document {
  title: string;
  slug: string;
  description?: string;
  artist: mongoose.Types.ObjectId;
  featuringArtists: mongoose.Types.ObjectId[];
  uploader: mongoose.Types.ObjectId;
  album?: mongoose.Types.ObjectId | null;
  genres: mongoose.Types.ObjectId[];

  // Media Files
  trackUrl: string;
  hlsUrl?: string;
  coverImage: string;

  // === LYRIC & KARAOKE (UPGRADED) ===
  // none: không lời, plain: lời thô, synced: theo dòng, karaoke: từng chữ
  lyricType: "none" | "plain" | "synced" | "karaoke";

  // URL dẫn đến file .json lưu trên B2 (Chứa data word-level cực chi tiết)
  lyricUrl?: string;

  // Lưu khoảng 5-10 câu đầu để FE hiển thị preview hoặc SEO, không lưu cả bài
  lyricPreview: ILyricPreview[];

  // Lời bài hát thô (Dùng để Search Engine của MongoDB index)
  plainLyrics?: string;

  // Visual Context
  moodVideo?: mongoose.Types.ObjectId; // ID của TrackMoodVideo (Canvas)

  // Technical Specs
  trackNumber: number;
  diskNumber: number;
  releaseDate: Date;
  isExplicit: boolean;
  copyright?: string;
  isrc?: string;
  tags: string[];
  duration: number;
  fileSize: number;
  format: string;
  bitrate: number;

  // Stats & Flags
  status: "pending" | "processing" | "ready" | "failed";
  isPublic: boolean;
  isDeleted: boolean;
  playCount: number;
  likeCount: number;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schema phụ cho Preview (nhẹ nhàng)
const LyricPreviewSchema = new Schema(
  {
    startTime: Number,
    text: String,
  },
  { _id: false },
);

const TrackSchema = new Schema<ITrack>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, required: true, trim: true },
    description: { type: String, maxlength: 2000 },

    artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
    featuringArtists: [{ type: Schema.Types.ObjectId, ref: "Artist" }],
    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true },
    album: { type: Schema.Types.ObjectId, ref: "Album", default: null },
    genres: [{ type: Schema.Types.ObjectId, ref: "Genre" }],

    trackUrl: { type: String, required: true },
    hlsUrl: { type: String, default: "" },
    coverImage: { type: String, default: "" },

    // === LYRICS & KARAOKE FIELDS ===
    lyricType: {
      type: String,
      enum: ["none", "plain", "synced", "karaoke"],
      default: "none",
      index: true,
    },
    lyricUrl: { type: String, default: "" }, // Đường dẫn file .json trên B2
    lyricPreview: [LyricPreviewSchema],
    plainLyrics: { type: String, default: "" },

    moodVideo: {
      type: Schema.Types.ObjectId,
      ref: "TrackMoodVideo",
      default: null,
      index: true,
    },

    trackNumber: { type: Number, default: 1 },
    diskNumber: { type: Number, default: 1 },
    releaseDate: { type: Date, default: Date.now },
    isExplicit: { type: Boolean, default: false },
    copyright: { type: String, trim: true },
    isrc: { type: String, trim: true, uppercase: true },
    tags: [{ type: String, trim: true, lowercase: true }],

    duration: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    format: { type: String, trim: true },
    bitrate: { type: Number, default: 0 },

    playCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    errorReason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
      index: true,
    },
    isPublic: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, select: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// --- INDEXING STRATEGY ---

// 1. Text Search: Bao gồm cả plainLyrics để user tìm bài hát qua lời
TrackSchema.index({ title: "text", tags: "text", plainLyrics: "text" });

TrackSchema.index({ isPublic: 1, isDeleted: 1, createdAt: -1 });
TrackSchema.index({ playCount: -1, isPublic: 1, isDeleted: 1 });
TrackSchema.index({ album: 1, diskNumber: 1, trackNumber: 1 });
TrackSchema.index({ artist: 1, isPublic: 1, releaseDate: -1 });

const Track = mongoose.model<ITrack>("Track", TrackSchema);
export default Track;
