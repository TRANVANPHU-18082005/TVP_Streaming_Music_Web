import mongoose, { Schema, Document } from "mongoose";

export interface IDailyStats extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // Định dạng "YYYY-MM-DD"
  count: number;
  updatedAt: Date;
}

const dailyStatsSchema = new Schema<IDailyStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// 🔥 QUAN TRỌNG: Compound Unique Index
// Chặn trùng lặp dữ liệu: 1 User + 1 Ngày chỉ có duy nhất 1 bản ghi Stats
dailyStatsSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<IDailyStats>("DailyStats", dailyStatsSchema);
