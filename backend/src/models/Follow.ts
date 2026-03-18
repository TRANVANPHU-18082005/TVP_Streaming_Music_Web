import mongoose, { Schema } from "mongoose";
const FollowSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    artistId: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
  },
  { timestamps: true },
);

FollowSchema.index({ followerId: 1, artistId: 1 }, { unique: true });

export default mongoose.model("Follow", FollowSchema);
