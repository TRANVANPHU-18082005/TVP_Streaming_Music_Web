import mongoose, { Schema, Document } from "mongoose";

// --- INTERFACE (Type Definition) ---
export interface ITrack extends Document {
  // 1. Basic Info
  title: string;
  slug: string;
  description?: string;

  // 2. Relationships
  artist: mongoose.Types.ObjectId; // Main Artist
  featuringArtists: mongoose.Types.ObjectId[]; // Feat.
  uploader: mongoose.Types.ObjectId; // User upload
  album?: mongoose.Types.ObjectId | null; // Album (Optional cho Single)
  genres: mongoose.Types.ObjectId[]; // Thể loại chính

  // 3. Media Files
  trackUrl: string; // File gốc (Source)
  hlsUrl?: string; // File stream (M3U8 - Adaptive Bitrate)
  coverImage: string; // Ảnh bìa

  // 4. Album Context (Metadata)
  trackNumber: number; // Thứ tự bài trong album
  diskNumber: number; // Đĩa số mấy (cho album nhiều đĩa)

  // 5. Legal & Release Info
  releaseDate: Date; // Ngày phát hành gốc
  isExplicit: boolean; // Nhãn 18+ (Explicit Content)
  copyright?: string; // Dòng bản quyền (℗ 2024...)
  isrc?: string; // Mã định danh bản ghi quốc tế

  // 6. Content & Search
  lyrics?: string; // Lời bài hát
  tags: string[]; // Mood/Keywords (Chill, Sad, Workout...)

  // 7. Technical Specs (Quality Control)
  duration: number; // Seconds
  fileSize: number; // Bytes
  format: string; // mp3, flac, aac...
  bitrate: number; // 128, 320, 1411 (kbps)

  // 8. Stats & Flags
  status: "pending" | "processing" | "ready" | "failed";
  isPublic: boolean;
  isDeleted: boolean; // Soft Delete
  playCount: number;
  likeCount: number;
  // Nếu status = failed, lưu lý do lỗi ở đây
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- SCHEMA DEFINITION ---
const TrackSchema = new Schema<ITrack>(
  {
    // === A. BASIC INFO ===
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200, // Tăng nhẹ giới hạn cho các bài tên dài
    },
    slug: { type: String, unique: true, required: true, trim: true },
    description: { type: String, maxlength: 2000 },

    // === B. RELATIONSHIPS ===
    artist: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    featuringArtists: [
      {
        type: Schema.Types.ObjectId,
        ref: "Artist",
      },
    ],
    uploader: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // 🔥 QUAN TRỌNG: Album là Optional (cho Single)
    album: {
      type: Schema.Types.ObjectId,
      ref: "Album",
      default: null,
      required: false,
    },
    genres: [{ type: Schema.Types.ObjectId, ref: "Genre" }],

    // === C. MEDIA & RESOURCES ===
    trackUrl: { type: String, required: true },
    hlsUrl: { type: String, default: "" }, // URL Stream tối ưu
    coverImage: { type: String, default: "" },

    // === D. METADATA & CONTEXT ===
    trackNumber: { type: Number, default: 1 }, // Bài số 1
    diskNumber: { type: Number, default: 1 }, // Đĩa 1

    // === E. LEGAL & COMPLIANCE ===
    // Ngày phát hành thực tế (VD: Bài ra năm 2000 nhưng 2024 mới upload)
    releaseDate: { type: Date, default: Date.now },
    // Cờ báo nội dung nhạy cảm (Bắt buộc cho App Store)
    isExplicit: { type: Boolean, default: false },
    copyright: { type: String, trim: true },
    // International Standard Recording Code (Quản lý bản quyền)
    isrc: { type: String, trim: true, uppercase: true },

    // === F. CONTENT & TAGS ===
    lyrics: { type: String }, // Có thể lưu text hoặc JSON time-synced
    tags: [{ type: String, trim: true, lowercase: true }], // Tags tìm kiếm

    // === G. TECHNICAL SPECS ===
    // Lưu lại để hiển thị badge chất lượng (Lossless/Hi-Res)
    duration: { type: Number, default: 0, min: 0 },
    fileSize: { type: Number, default: 0 },
    format: { type: String, trim: true }, // 'mp3', 'flac'
    bitrate: { type: Number, default: 0 }, // 320

    // === H. STATS & FLAGS ===
    playCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },

    errorReason: {
      type: String,
      default: "", // Mặc định là rỗng
    },

    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
      index: true,
    },
    isPublic: { type: Boolean, default: true },
    // Soft Delete: Mặc định ẩn khỏi query thường (phải select: '+isDeleted' mới thấy)
    isDeleted: { type: Boolean, default: false, select: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- INDEXING STRATEGY (Chiến lược Index tối ưu) ---

// 1. Text Search: Tìm theo Tên bài hát và Tags (Mood)
TrackSchema.index({ title: "text", tags: "text" });

// 2. Trang chủ: Lấy bài hát mới nhất (Public & Chưa xóa)
TrackSchema.index({ isPublic: 1, isDeleted: 1, createdAt: -1 });

// 3. Bảng xếp hạng: Sắp xếp theo PlayCount
TrackSchema.index({ playCount: -1, isPublic: 1, isDeleted: 1 });

// 4. Album Detail: Sắp xếp bài hát ĐÚNG THỨ TỰ trong Album
// Sort: Album -> Đĩa 1 -> Bài 1, Bài 2...
TrackSchema.index({ album: 1, diskNumber: 1, trackNumber: 1 });

// 5. Artist Profile: Lấy bài hát của ca sĩ (Mới nhất trước)
TrackSchema.index({ artist: 1, isPublic: 1, releaseDate: -1 });

// 6. Browse Genre: Duyệt theo thể loại
TrackSchema.index({ genres: 1, isPublic: 1 });

const Track = mongoose.model<ITrack>("Track", TrackSchema);
export default Track;
