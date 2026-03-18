import mongoose, { Schema } from "mongoose";

const LikeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  },
  { timestamps: true },
);

// 🔥 QUAN TRỌNG: Chặn trùng lặp ở tầng Database và tăng tốc độ tìm kiếm
LikeSchema.index({ userId: 1, trackId: 1 }, { unique: true });

export default mongoose.model("Like", LikeSchema);
