import mongoose, { Schema, Document } from "mongoose";

export interface IPlayLog extends Document {
  trackId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  listenedAt: Date;
  ip?: string;
  source?: string;
}

const playLogSchema = new Schema<IPlayLog>(
  {
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    listenedAt: { type: Date, default: Date.now }, // Bắt buộc phải là Date
    ip: { type: String },
    source: { type: String, default: "web" },
  },
  {
    versionKey: false,
    timestamps: false,
  },
);

// Index 1: Giúp query range thời gian và group nhanh (cho Chart Service)
playLogSchema.index({ listenedAt: -1, trackId: 1 });

// Tăng lên 7 ngày + 1 ngày dự phòng = 8 ngày (691200 giây)
playLogSchema.index({ listenedAt: 1 }, { expireAfterSeconds: 691200 });

// Quan trọng: Thêm Compound Index để tránh Scan toàn bộ bảng
playLogSchema.index({ userId: 1, listenedAt: 1 });

export default mongoose.model<IPlayLog>("PlayLog", playLogSchema);
