import mongoose, { Schema } from "mongoose";

const FollowSchema = new Schema(
  {
    // Ai là người đi follow?
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Follow ai? (Có thể là User khác hoặc Artist)
    // Ở đây mình ví dụ follow Artist (phổ biến nhất app nhạc)
    following: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Đảm bảo 1 user chỉ follow 1 artist 1 lần (Composite Unique Index)
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

export default mongoose.model("Follow", FollowSchema);
