// models/Genre.ts

import mongoose, { Schema, Document, Model } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";
import themeColorService from "../services/themeColor.service";

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

  // 2. Extract theme color và Gradient
  if (genre.isModified("image") && genre.image) {
    if (!genre.isModified("color")) {
      try {
        genre.color = await themeColorService.extractThemeColor(genre.image);
        // Khi color tự động đổi do image đổi -> Trigger tạo gradient mới
        genre.gradient = `linear-gradient(135deg, ${genre.color} 0%, #121212 100%)`;
      } catch (err) {
        genre.color = "#121212"; // Fallback color an toàn
        genre.gradient = `linear-gradient(135deg, #121212 0%, #121212 100%)`;
      }
    } else if (genre.isModified("color") && !genre.isModified("gradient")) {
      // Chỉ update gradient nếu color đổi mà gradient không bị override
      genre.gradient = `linear-gradient(135deg, ${genre.color} 0%, #121212 100%)`;
    }
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
  const genre = mongoose.model("genre");
  const Artist = mongoose.model("Artist");

  const [tCount, alCount, arCount] = await Promise.all([
    Track.countDocuments({
      genres: genreId,
      status: "ready",
      isPublic: true,
      isDeleted: false,
    }),
    genre.countDocuments({ genres: genreId, isPublic: true }),
    Artist.countDocuments({ genres: genreId, isActive: true }),
  ]);

  await (this as Model<IGenre>).findByIdAndUpdate(genreId, {
    trackCount: tCount,
    genreCount: alCount,
    artistCount: arCount,
  });
};

export default mongoose.model<IGenre, IGenreModel>("Genre", GenreSchema);
