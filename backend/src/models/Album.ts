// models/Album.ts — thêm static calculateStats()

import mongoose, { Schema, Document, Model } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";
import themeColorService from "../services/themeColor.service";

export interface IAlbum extends Document {
  title: string;
  slug: string;
  artist: mongoose.Types.ObjectId;
  description?: string;
  type: "album" | "single" | "ep" | "compilation";
  tags: string[];
  coverImage: string;
  themeColor: string;
  releaseDate: Date;
  releaseYear: number;
  totalTracks: number;
  totalDuration: number;
  playCount: number; // Tổng lượt nghe của Album
  likeCount: number; // Số lượng yêu thích
  fileSize: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── FIX 4: Thêm static method vào interface Model ────────────────────────────
export interface IAlbumModel extends Model<IAlbum> {
  /**
   * Tính lại totalTracks và totalDuration từ bảng Track.
   * Gọi khi có biến động lớn (bulk update, transcode complete, v.v.)
   * để đảm bảo số liệu Album luôn chính xác 100%.
   */
  calculateStats(albumId: string): Promise<void>;
}

const AlbumSchema = new Schema<IAlbum>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true },
    artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
    description: { type: String, maxlength: 2000 },

    coverImage: { type: String, default: "" },
    themeColor: { type: String, default: "#1db954" },

    type: {
      type: String,
      enum: ["album", "single", "ep", "compilation"],
      default: "album",
      index: true,
    },
    tags: {
      type: [String],
      trim: true,
      lowercase: true,
      default: [],
      index: true,
    },

    releaseDate: { type: Date, default: Date.now },
    releaseYear: { type: Number, index: true },

    totalTracks: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },

    fileSize: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── INDEXES ───────────────────────────────────────────────────────────────────
AlbumSchema.index({ title: "text", tags: "text" });
AlbumSchema.index({ artist: 1, isPublic: 1, releaseDate: -1 });
AlbumSchema.index({ genres: 1, isPublic: 1, releaseDate: -1 });
AlbumSchema.index({ isPublic: 1, playCount: -1 });
AlbumSchema.index({ isPublic: 1, type: 1, releaseDate: -1 });
AlbumSchema.index({ isPublic: 1, releaseYear: 1 });
AlbumSchema.index({ isPublic: 1, releaseDate: -1 });

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
AlbumSchema.pre("save", async function () {
  const album = this as any;

  if (album.isModified("title")) {
    const AlbumModel = album.constructor as mongoose.Model<IAlbum>;
    album.slug = await generateUniqueSlug(
      AlbumModel,
      album.title,
      album.isNew ? undefined : album._id,
    );
  }

  if (album.isModified("coverImage") && album.coverImage) {
    if (!album.isModified("themeColor")) {
      try {
        album.themeColor = await themeColorService.extractThemeColor(
          album.coverImage,
        );
      } catch {
        album.themeColor = "#1db954";
      }
    }
  }

  if (album.isModified("releaseDate") || album.isNew) {
    if (album.releaseDate) {
      album.releaseYear = new Date(album.releaseDate).getFullYear();
    }
  }
});

// ── VIRTUAL ───────────────────────────────────────────────────────────────────
AlbumSchema.virtual("tracks", {
  ref: "Track",
  localField: "_id",
  foreignField: "album",
  justOne: false,
  options: { sort: { diskNumber: 1, trackNumber: 1 } },
});

// ── FIX 4: STATIC METHOD ─────────────────────────────────────────────────────
/**
 * Tính lại totalTracks & totalDuration trực tiếp từ Track collection.
 * Dùng aggregate để đảm bảo số liệu chính xác tuyệt đối, bất kể
 * counter trước đó có bị drift hay không.
 *
 * Khi nào gọi:
 *   - Sau bulkUpdateTracks có albumId
 *   - Sau khi transcode complete (duration thực tế có thể khác duration khai báo)
 *   - Định kỳ qua reconciliation job (weekly) để sửa drift tích lũy
 */
AlbumSchema.statics.calculateStats = async function (
  albumId: string,
): Promise<void> {
  // Import Track lazily để tránh circular dependency
  const Track = mongoose.model("Track");

  const [result] = await Track.aggregate([
    {
      $match: {
        album: new mongoose.Types.ObjectId(albumId),
        isDeleted: false,
        status: "ready",
        isPublic: true,
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

  await (this as Model<IAlbum>).findByIdAndUpdate(albumId, {
    totalTracks: result?.totalTracks ?? 0,
    totalDuration: result?.totalDuration ?? 0,
  });
};

export default mongoose.model<IAlbum, IAlbumModel>("Album", AlbumSchema);
