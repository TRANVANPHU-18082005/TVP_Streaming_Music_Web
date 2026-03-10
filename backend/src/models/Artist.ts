import mongoose, { Schema, Document } from "mongoose";

export interface IArtist extends Document {
  user?: mongoose.Types.ObjectId | null;
  name: string;
  slug: string;

  // --- MỚI THÊM ---
  aliases: string[]; // Tên khác (VD: ["MTP", "Son Tung"])
  nationality: string; // Mã quốc gia (VN, US, KR...)

  bio: string;
  avatar: string;
  coverImage: string;

  // --- MỚI THÊM ---
  images: string[]; // Gallery ảnh (Slide)
  themeColor: string; // Màu Hex chủ đạo (#ff0000)

  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
    spotify?: string; // Nên thêm link sang các nền tảng khác
    youtube?: string;
  };

  genres: mongoose.Types.ObjectId[];

  // Stats
  totalTracks: number;
  totalAlbums: number;
  totalFollowers: number;
  totalPlays: number;

  // --- MỚI THÊM ---
  monthlyListeners: number; // Chỉ số quan trọng (update bằng Cron Job)

  isVerified: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ArtistSchema = new Schema<IArtist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    name: { type: String, required: true, trim: true, maxlength: 100 },

    // 🔥 SEARCH OPTIMIZATION
    // Lưu các biến thể tên: "son tung", "mtp", "sơn tùng m-tp"
    aliases: [{ type: String, trim: true, lowercase: true }],

    // 🔥 LOCALIZATION & CHART
    // VD: "VN", "US". Dùng để lọc BXH theo quốc gia
    nationality: { type: String, default: "VN", uppercase: true, trim: true },

    slug: {
      type: String,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    bio: { type: String, default: "", maxlength: 2000 },

    // --- VISUALS ---
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    // Gallery ảnh nghệ sĩ (cho Slider)
    images: [{ type: String }],
    // Màu chủ đạo trích xuất từ Avatar (VD: #1db954) -> UI dùng làm background gradient
    themeColor: { type: String, default: "#ffffff" },

    genres: [{ type: Schema.Types.ObjectId, ref: "Genre" }],

    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
      spotify: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },

    // --- STATISTICS ---
    totalTracks: { type: Number, default: 0, min: 0 },
    totalAlbums: { type: Number, default: 0, min: 0 },
    totalFollowers: { type: Number, default: 0, min: 0 },
    totalPlays: { type: Number, default: 0, min: 0 },

    // Số người nghe trong 28 ngày qua (Tính toán riêng bởi Analytics Worker)
    monthlyListeners: { type: Number, default: 0, min: 0 },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- INDEXING CHIẾN LƯỢC ---

// 1. Text Search (Nâng cao): Tìm cả tên chính lẫn tên phụ (aliases)
ArtistSchema.index(
  { name: "text", aliases: "text", bio: "text" },
  { weights: { name: 10, aliases: 5, bio: 1 } } // Ưu tiên khớp tên chính > alias > bio
);

// 2. Partial Unique User
ArtistSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
  }
);

// 3. Sorting & Filtering
ArtistSchema.index({ totalPlays: -1 });
ArtistSchema.index({ monthlyListeners: -1 }); // BXH độ hot hiện tại
ArtistSchema.index({ nationality: 1, totalPlays: -1 }); // Top nghệ sĩ theo quốc gia

export default mongoose.model<IArtist>("Artist", ArtistSchema);
