// models/KaraokeRecording.ts

import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type KaraokeRecordingStatus =
  | "uploaded"        // Đã upload lên cloud, chưa gửi duyệt
  | "pending_review"  // Đang chờ admin duyệt
  | "approved"        // Admin đã duyệt — hiển thị cộng đồng
  | "rejected";       // Admin từ chối

export interface IKaraokeRecording extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  slug: string;

  // YouTube source
  youtubeVideoId: string;
  youtubeTitle: string;
  youtubeThumbnail?: string;

  // Audio trên cloud
  audioUrl: string;        // B2/CDN URL
  audioDuration: number;   // Thời lượng (giây)
  audioSize: number;       // Kích thước file (bytes)

  // Metadata
  coverImage?: string;
  description?: string;
  tags: string[];

  // Status & Moderation
  status: KaraokeRecordingStatus;
  isPublic: boolean;       // Hiển thị public sau khi approved?
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  reviewNote?: string;     // Ghi chú nội bộ của admin

  // Stats (chỉ tính khi approved + public)
  playCount: number;
  likeCount: number;
  likedBy: mongoose.Types.ObjectId[];
  shareCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const KaraokeRecordingSchema = new Schema<IKaraokeRecording>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, trim: true },

    // YouTube source
    youtubeVideoId: { type: String, required: true, trim: true },
    youtubeTitle: { type: String, required: true, trim: true, maxlength: 300 },
    youtubeThumbnail: { type: String, default: "" },

    // Audio
    audioUrl: { type: String, required: true },
    audioDuration: { type: Number, required: true, min: 0 },
    audioSize: { type: Number, required: true, min: 0 },

    // Metadata
    coverImage: { type: String, default: "" },
    description: { type: String, default: "", maxlength: 1000 },
    tags: [{ type: String, lowercase: true, trim: true }],

    // Status & Moderation
    status: {
      type: String,
      enum: ["uploaded", "pending_review", "approved", "rejected"],
      default: "uploaded",
    },
    isPublic: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", maxlength: 500 },
    reviewNote: { type: String, default: "", maxlength: 500 },

    // Stats
    playCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    shareCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// Query recordings của user
KaraokeRecordingSchema.index({ user: 1, createdAt: -1 });

// Admin duyệt: lọc theo status
KaraokeRecordingSchema.index({ status: 1, createdAt: -1 });

// Feed cộng đồng: approved + public, sort by mới nhất / phổ biến
KaraokeRecordingSchema.index({ status: 1, isPublic: 1, createdAt: -1 });
KaraokeRecordingSchema.index({ status: 1, isPublic: 1, playCount: -1 });

// Text search
KaraokeRecordingSchema.index({ title: "text", description: "text", tags: "text" });

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE: Auto generate slug
// ─────────────────────────────────────────────────────────────────────────────

KaraokeRecordingSchema.pre("validate", async function () {
  if (this.isNew && !this.slug) {
    // Tạo slug đơn giản từ title + timestamp
    const base = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
    const suffix = Date.now().toString(36);
    this.slug = `${base}-${suffix}`;
  }
});

export default mongoose.model<IKaraokeRecording>("KaraokeRecording", KaraokeRecordingSchema);
