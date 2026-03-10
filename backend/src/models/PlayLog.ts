import mongoose, { Schema, Document } from "mongoose";

export interface IPlayLog extends Document {
  trackId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
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
  }
);

// Index 1: Giúp query range thời gian và group nhanh (cho Chart Service)
playLogSchema.index({ listenedAt: -1, trackId: 1 });

// Index 2: TTL Index - Tự động xóa sau 3 ngày (3 * 24 * 60 * 60 = 259200s)
// "expireAfterSeconds" là từ khóa bắt buộc của MongoDB
playLogSchema.index({ listenedAt: 1 }, { expireAfterSeconds: 259200 });

export default mongoose.model<IPlayLog>("PlayLog", playLogSchema);
