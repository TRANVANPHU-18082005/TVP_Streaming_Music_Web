import mongoose, { Schema, Document } from "mongoose";

export interface IAlbum extends Document {
  // 1. Basic Info
  title: string;
  slug: string;
  artist: mongoose.Types.ObjectId; // Main Artist
  description?: string;

  // 2. Classification
  type: "album" | "single" | "ep" | "compilation"; // Thêm Compilation
  genres: mongoose.Types.ObjectId[];
  tags: string[]; // Search keywords

  // 3. Visuals
  coverImage: string;
  themeColor: string; // Màu chủ đạo (Hex)

  // 4. Release Info
  releaseDate: Date;
  releaseYear: number;
  label: string; // Hãng đĩa (VD: Sony Music)
  copyright: string; // (VD: ℗ 2024 Artist Name)
  upc: string; // Mã định danh sản phẩm quốc tế

  // 5. Stats (Denormalized - Cập nhật khi bài hát được nghe/like)
  totalTracks: number;
  totalDuration: number;
  playCount: number; // Tổng lượt nghe của Album
  likeCount: number; // Số lượng yêu thích

  isPublic: boolean;

  // Virtuals
  tracks?: any[];

  createdAt: Date;
  updatedAt: Date;
}

const AlbumSchema = new Schema<IAlbum>(
  {
    // --- BASIC ---
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true },
    artist: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
    description: { type: String, maxlength: 2000 },

    // --- VISUALS ---
    coverImage: { type: String, default: "" },
    themeColor: { type: String, default: "#1db954" }, // Màu mặc định

    // --- CLASSIFICATION ---
    type: {
      type: String,
      enum: ["album", "single", "ep", "compilation"], // Compilation: Album tổng hợp nhiều ca sĩ
      default: "album",
      index: true,
    },
    genres: [{ type: Schema.Types.ObjectId, ref: "Genre" }],
    tags: {
      type: [String], // Mảng chuỗi
      trim: true,
      lowercase: true, // Tự động viết thường hết để search cho dễ (HipHop == hiphop)
      default: [],
      index: true, // 🔥 Quan trọng: Đánh index để lọc theo tag cực nhanh
    },

    // --- RELEASE & LEGAL (Chuẩn Production) ---
    releaseDate: { type: Date, default: Date.now },
    releaseYear: { type: Number, index: true },

    label: { type: String, trim: true }, // Record Label
    copyright: { type: String, trim: true }, // Copyright Notice
    upc: { type: String, trim: true, uppercase: true }, // Barcode

    // --- STATS ---
    totalTracks: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },

    isPublic: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// --- INDEXING STRATEGY ---

// 1. Text Search
AlbumSchema.index({ title: "text", tags: "text" });

// 2. Artist Page: Lấy album của ca sĩ (Mới nhất trước)
AlbumSchema.index({ artist: 1, isPublic: 1, releaseDate: -1 });

// 3. Browse/Home: Lọc theo Genre + Mới nhất
AlbumSchema.index({ genres: 1, isPublic: 1, releaseDate: -1 });

// 4. 🔥 Charts: Top Albums (Hot nhất)
AlbumSchema.index({ isPublic: 1, playCount: -1 });

// 5. New Releases Global
AlbumSchema.index({ isPublic: 1, releaseDate: -1 });
// --- MIDDLEWARE ---
AlbumSchema.pre("save", async function () {
  if (this.isModified("releaseDate") || this.isNew) {
    if (this.releaseDate) {
      this.releaseYear = new Date(this.releaseDate).getFullYear();
    }
  }
});

// --- VIRTUALS ---
AlbumSchema.virtual("tracks", {
  ref: "Track",
  localField: "_id",
  foreignField: "album",
  justOne: false,
  // Quan trọng: Sort theo diskNumber trước, rồi tới trackNumber
  options: { sort: { diskNumber: 1, trackNumber: 1 } },
});

export default mongoose.model<IAlbum>("Album", AlbumSchema);
