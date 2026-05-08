import mongoose, { Schema, Document, Model } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface IArtist extends Document {
  user?: mongoose.Types.ObjectId | null;
  name: string;
  slug: string;
  aliases: string[];
  nationality: string;
  bio: string;
  avatar: string;
  coverImage: string;
  images: string[];
  themeColor: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
    spotify?: string;
    youtube?: string;
  };
  totalTracks: number;
  totalAlbums: number;
  totalFollowers: number;
  playCount: number;
  monthlyListeners: number;
  isVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IArtistModel extends Model<IArtist> {
  /**
   * Đồng bộ Stats thực tế từ Track và Album collections.
   * Đảm bảo Artist Dashboard không bao giờ bị lệch số liệu (drift).
   */
  calculateStats(artistId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

const ArtistSchema = new Schema<IArtist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    aliases: [{ type: String, trim: true, lowercase: true }],
    nationality: { type: String, default: "VN", uppercase: true, trim: true },
    bio: { type: String, default: "", maxlength: 200 },
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    images: [{ type: String }],
    themeColor: { type: String, default: "#ffffff" },

    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
      spotify: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
    totalTracks: { type: Number, default: 0, min: 0 },
    totalAlbums: { type: Number, default: 0, min: 0 },
    totalFollowers: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
    monthlyListeners: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXING STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

// Text search nâng cao cho bộ lọc tìm kiếm
ArtistSchema.index(
  { name: "text", aliases: "text", bio: "text" },
  { weights: { name: 10, aliases: 5, bio: 1 } },
);

// Sorting & Ranking Index
ArtistSchema.index({ playCount: -1 });
ArtistSchema.index({ monthlyListeners: -1 });
ArtistSchema.index({ nationality: 1, playCount: -1 });

// Partial unique cho user account link
ArtistSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: "objectId" } } },
);

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE (Automation)
// ─────────────────────────────────────────────────────────────────────────────

ArtistSchema.pre("save", async function () {
  const artist = this as any;

  // 1. Tự động tạo SEO Slug đồng bộ với Album logic
  if (artist.isModified("name")) {
    const ArtistModel = artist.constructor as mongoose.Model<IArtist>;
    artist.slug = await generateUniqueSlug(
      ArtistModel,
      artist.name,
      artist.isNew ? undefined : artist._id,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS (Data Relationships)
// ─────────────────────────────────────────────────────────────────────────────

// Lấy danh sách Album mới nhất của nghệ sĩ
ArtistSchema.virtual("albums", {
  ref: "Album",
  localField: "_id",
  foreignField: "artist",
  justOne: false,
  options: { sort: { releaseDate: -1 } },
});

// Lấy Top 5 bài hát hot nhất của nghệ sĩ
ArtistSchema.virtual("topTracks", {
  ref: "Track",
  localField: "_id",
  foreignField: "artist",
  justOne: false,
  options: { sort: { playCount: -1 }, limit: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS (Reconciliation)
// ─────────────────────────────────────────────────────────────────────────────

ArtistSchema.statics.calculateStats = async function (
  artistId: string,
): Promise<void> {
  const Track = mongoose.model("Track");
  const Album = mongoose.model("Album");

  const [trackStats, albumCount] = await Promise.all([
    Track.aggregate([
      {
        $match: {
          artist: new mongoose.Types.ObjectId(artistId),
          status: "ready",
          isPublic: true,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalTracks: { $sum: 1 },
          playCount: { $sum: { $ifNull: ["$playCount", 0] } },
        },
      },
    ]),
    Album.countDocuments({ artist: artistId, isPublic: true }),
  ]);

  const stats = trackStats[0] || { totalTracks: 0, playCount: 0 };

  await this.findByIdAndUpdate(artistId, {
    totalTracks: stats.totalTracks,
    totalAlbums: albumCount,
    playCount: stats.playCount,
  });
};

export default mongoose.model<IArtist, IArtistModel>("Artist", ArtistSchema);
