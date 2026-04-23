import mongoose, { Schema, Document, Model } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ITrackMoodVideo extends Document {
  title: string;
  slug: string;
  videoUrl: string;
  thumbnailUrl: string;
  tags: string[];
  loop: boolean; // Mới: Quy định video có được loop liên tục không
  isActive: boolean;
  usageCount: number; // Đếm số lượng bài hát đang sử dụng Canvas này
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrackMoodVideoModel extends Model<ITrackMoodVideo> {
  /**
   * Tính toán lại chính xác usageCount từ bảng Track.
   * Đảm bảo số liệu thống kê mức độ phổ biến của Canvas luôn chuẩn xác.
   */
  calculateUsage(videoId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

const TrackMoodVideoSchema = new Schema<ITrackMoodVideo>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    tags: {
      type: [String],
      lowercase: true,
      trim: true,
      default: [],
      index: true, // Tối ưu tìm kiếm Canvas theo mood
    },
    loop: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    usageCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXING STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

// Hỗ trợ Admin tìm kiếm Canvas nhanh theo tiêu đề và tags
TrackMoodVideoSchema.index({ title: "text", tags: "text" });

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE (Automation)
// ─────────────────────────────────────────────────────────────────────────────

TrackMoodVideoSchema.pre("save", async function () {
  const moodVideo = this as any;

  // Tự động tạo SEO Slug khi đổi tên giống Album logic
  if (moodVideo.isModified("title")) {
    const MoodVideoModel =
      moodVideo.constructor as mongoose.Model<ITrackMoodVideo>;
    moodVideo.slug = await generateUniqueSlug(
      MoodVideoModel,
      moodVideo.title,
      moodVideo.isNew ? undefined : moodVideo._id,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

// Lấy danh sách các bài hát đang sử dụng Canvas này
TrackMoodVideoSchema.virtual("tracks", {
  ref: "Track",
  localField: "_id",
  foreignField: "moodVideo",
  justOne: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS (Reconciliation)
// ─────────────────────────────────────────────────────────────────────────────

TrackMoodVideoSchema.statics.calculateUsage = async function (
  videoId: string,
): Promise<void> {
  const Track = mongoose.model("Track");

  // Đếm thực tế số lượng bài hát đang gắn ID video này
  const count = await Track.countDocuments({
    moodVideo: new mongoose.Types.ObjectId(videoId),
    isDeleted: false,
  });

  await this.findByIdAndUpdate(videoId, { usageCount: count });
};

export default mongoose.model<ITrackMoodVideo, ITrackMoodVideoModel>(
  "TrackMoodVideo",
  TrackMoodVideoSchema,
);
