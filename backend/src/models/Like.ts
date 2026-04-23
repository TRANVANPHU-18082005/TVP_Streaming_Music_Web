import mongoose, { Schema } from "mongoose";

const LikeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, required: true }, // ID của Track hoặc Album hoặc Playlist
    targetType: {
      type: String,
      enum: ["track", "album", "playlist"],
      required: true,
      default: "track",
    },
  },
  { timestamps: true },
);

// 🔥 QUAN TRỌNG: Compound Index phải bao gồm cả targetType
// Chặn trường hợp: 1 user like 1 ID vừa là track vừa là album (nếu trùng ID)
LikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
LikeSchema.index({ userId: 1, targetType: 1 });
export default mongoose.model("Like", LikeSchema);
