import mongoose, { Schema, Document } from "mongoose";

export interface ITrackMoodVideo extends Document {
  title: string;
  slug: string;
  videoUrl: string; // URL video đã tối ưu (Cloudinary/S3)
  thumbnailUrl: string; // Ảnh preview để Admin chọn
  tags: string[]; // ["sad", "lofi", "rainy"]
  isActive: boolean;
  usageCount: number; // Thống kê số lượng bài hát đang dùng
}

const TrackMoodVideoSchema = new Schema<ITrackMoodVideo>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    tags: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true, index: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để tìm kiếm video theo mood nhanh hơn
TrackMoodVideoSchema.index({ tags: 1 });

export default mongoose.model<ITrackMoodVideo>(
  "TrackMoodVideo",
  TrackMoodVideoSchema,
);
