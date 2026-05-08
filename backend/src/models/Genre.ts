// models/Genre.ts

import mongoose, { Schema, Document, Model } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface IGenre extends Document {
  name: string;
  slug: string;
  description: string;
  parentId?: mongoose.Types.ObjectId | null;
  image: string;
  color: string;
  gradient: string;
  priority: number;
  isTrending: boolean;
  trackCount: number;
  playCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGenreModel extends Model<IGenre> {
  calculateStats(genreId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const GenreSchema = new Schema<IGenre>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 500 },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Genre",
      default: null,
      index: true,
    },
    image: { type: String, default: "" },
    color: {
      type: String,
      default: "#6366f1",
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Mã màu không hợp lệ"],
    },
    gradient: { type: String, default: "" },
    priority: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false },
    trackCount: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
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

GenreSchema.index({ priority: -1, trackCount: -1, name: 1 });
GenreSchema.index({ name: "text", description: "text" });
GenreSchema.index({ parentId: 1, isActive: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

GenreSchema.pre("save", async function () {
  const genre = this as any;

  // 1. Auto-generate slug: Chỉ khi name đổi VÀ slug không được Admin sửa thủ công
  if (genre.isModified("name") && !genre.isModified("slug")) {
    const GenreModel = genre.constructor as mongoose.Model<IGenre>;
    genre.slug = await generateUniqueSlug(
      GenreModel,
      genre.name,
      genre.isNew ? undefined : genre._id,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

GenreSchema.virtual("subGenres", {
  ref: "Genre",
  localField: "_id",
  foreignField: "parentId",
});

GenreSchema.virtual("topTracks", {
  ref: "Track",
  localField: "_id",
  foreignField: "genres",
  options: { sort: { playCount: -1 }, limit: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

GenreSchema.statics.calculateStats = async function (
  genreId: string,
): Promise<void> {
  const Track = mongoose.model("Track");

  const [tCount] = await Promise.all([
    Track.countDocuments({
      genres: genreId,
      status: "ready",
      isPublic: true,
      isDeleted: false,
    }),
  ]);

  await (this as Model<IGenre>).findByIdAndUpdate(genreId, {
    trackCount: tCount,
  });
};

export default mongoose.model<IGenre, IGenreModel>("Genre", GenreSchema);
