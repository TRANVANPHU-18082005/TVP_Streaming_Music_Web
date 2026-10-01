import mongoose, { Schema, Document } from "mongoose";

/** Listen audit retention. 30 days. Lifetime Track.playCount is a separate counter. */
export const PLAY_LOG_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface PlayLogIndexSpec {
  key: Record<string, number>;
  name?: string;
  expireAfterSeconds?: number;
}

/** The TTL index is `{ listenedAt: 1 }` alone. The chart index also starts with listenedAt. */
export function findPlayLogTtlIndex(
  indexes: PlayLogIndexSpec[],
): PlayLogIndexSpec | undefined {
  return indexes.find(
    (index) =>
      index.expireAfterSeconds !== undefined &&
      index.key.listenedAt === 1 &&
      Object.keys(index.key).length === 1,
  );
}

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

// 30 ngày. Index đã tồn tại trên Atlas không tự đổi expireAfterSeconds.
// `npm run migrate:playlog-ttl` gọi collMod cho index này.
playLogSchema.index({ listenedAt: 1 }, { expireAfterSeconds: PLAY_LOG_TTL_SECONDS });

// Quan trọng: Thêm Compound Index để tránh Scan toàn bộ bảng
playLogSchema.index({ userId: 1, listenedAt: 1 });
playLogSchema.index({ userId: 1, trackId: 1 });

export default mongoose.model<IPlayLog>("PlayLog", playLogSchema);
