import mongoose, { Schema, Document } from "mongoose";

export interface IGenre extends Document {
  name: string;
  slug: string;
  description: string;

  // 1. Hierarchy (Phân cấp cha-con)
  parentId?: mongoose.Types.ObjectId | null;

  // 2. Visuals
  image: string; // Ảnh đại diện vuông
  color: string; // Màu chủ đạo (Hex)
  gradient?: string; // CSS Gradient (VD: "linear-gradient(to right, #ff0099, #493240)")

  // 3. Sorting & Curation
  priority: number; // Độ ưu tiên hiển thị (số càng lớn càng hiện đầu)
  isTrending: boolean; // Có đang hot không?

  // 4. Stats (Counter Cache)
  trackCount: number;
  albumCount: number; // Thêm đếm Album
  artistCount: number; // Thêm đếm Nghệ sĩ

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

    // --- HIERARCHY ---
    // Link tới chính Collection này (Self-referencing)
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Genre",
      default: null,
      index: true,
    },

    // --- VISUALS ---
    image: { type: String, default: "" },
    color: {
      type: String,
      default: "#6366f1",
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Mã màu không hợp lệ"],
    },
    // Lưu string CSS Gradient để FE render background đẹp hơn
    gradient: { type: String, default: "" },

    // --- CURATION ---
    priority: { type: Number, default: 0, index: -1 }, // Mặc định 0
    isTrending: { type: Boolean, default: false },

    // --- STATS (Denormalized) ---
    trackCount: { type: Number, default: 0, min: 0 },
    albumCount: { type: Number, default: 0, min: 0 },
    artistCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// --- INDEXING STRATEGY ---

// 1. Browse Page: Lấy Genre ưu tiên trước, sau đó đến phổ biến
// Sort: Priority giảm dần -> Track nhiều -> Tên A-Z
GenreSchema.index({ priority: -1, trackCount: -1, name: 1 });

// 2. Sub-genre: Tìm các thể loại con của 1 thể loại cha
GenreSchema.index({ parentId: 1, isActive: 1 });

// 3. Trending Section
GenreSchema.index({ isTrending: 1, priority: -1 });

export default mongoose.model<IGenre>("Genre", GenreSchema);
