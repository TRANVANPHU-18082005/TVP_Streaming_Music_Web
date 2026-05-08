// models/Playlist.ts

import mongoose, { Schema, Document, Model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface IPlaylist extends Document {
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  themeColor: string;
  user: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[];
  tracks: mongoose.Types.ObjectId[];
  totalTracks: number;
  totalDuration: number;
  playCount: number; // Tổng lượt nghe của playlist này
  likeCount: number;
  tags: string[];
  type: "playlist" | "album" | "radio" | "mix";
  publishAt: Date;
  visibility: "public" | "private" | "unlisted";
  isSystem: boolean;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface IPlaylistModel extends Model<IPlaylist> {
  calculateStats(playlistId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistSchema = new Schema<IPlaylist>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "", maxlength: 1000 },
    coverImage: { type: String, default: "" },
    themeColor: { type: String, default: "#1db954" },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // Mảng ID bài hát — thứ tự có ý nghĩa (playlist ordering)
    tracks: [{ type: Schema.Types.ObjectId, ref: "Track" }],

    totalTracks: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    tags: [{ type: String, trim: true, lowercase: true }],
    type: {
      type: String,
      enum: ["playlist", "album", "radio", "mix"],
      default: "playlist",
    },
    publishAt: { type: Date, default: Date.now, index: true },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
      index: true,
    },
    isSystem: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

PlaylistSchema.index({ title: "text", tags: "text" });
PlaylistSchema.index({ user: 1, createdAt: -1 });
PlaylistSchema.index({ visibility: 1, isSystem: 1, followersCount: -1 });
PlaylistSchema.index({ tags: 1, visibility: 1 });

// FIX: Thêm index cho collaborators — frequent query trong phân quyền
PlaylistSchema.index({ collaborators: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// STATIC: calculateStats
// ─────────────────────────────────────────────────────────────────────────────

PlaylistSchema.statics.calculateStats = async function (
  playlistId: string,
): Promise<void> {
  const Track = mongoose.model("Track");
  const playlist = await this.findById(playlistId).select("tracks").lean();

  if (!playlist || !(playlist as any).tracks?.length) {
    await this.findByIdAndUpdate(playlistId, {
      totalTracks: 0,
      totalDuration: 0,
    });
    return;
  }

  const [result] = await Track.aggregate([
    {
      $match: {
        _id: { $in: (playlist as any).tracks },
        status: "ready",
        isDeleted: false,
        isPublic: true, // FIX: chỉ tính tracks public và ready
      },
    },
    {
      $group: {
        _id: null,
        totalTracks: { $sum: 1 },
        totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
      },
    },
  ]);

  await (this as Model<IPlaylist>).findByIdAndUpdate(playlistId, {
    totalTracks: result?.totalTracks ?? 0,
    totalDuration: result?.totalDuration ?? 0,
  });
};

export default mongoose.model<IPlaylist, IPlaylistModel>(
  "Playlist",
  PlaylistSchema,
);
