import mongoose, { Schema, Document } from "mongoose";

export interface IPlaylist extends Document {
  // ... (Các trường cơ bản)
  title: string;
  slug: string;
  description: string;

  // 1. Media & Visuals
  coverImage: string;
  themeColor: string; // Màu chủ đạo (Hex) cho UI Gradient

  // 2. Ownership & Collaboration (Nâng cấp)
  user: mongoose.Types.ObjectId; // Owner
  collaborators: mongoose.Types.ObjectId[]; // Danh sách user được quyền sửa

  // 3. Content
  tracks: mongoose.Types.ObjectId[];

  // 4. Stats (Denormalized)
  totalTracks: number;
  totalDuration: number;
  followersCount: number; // Số người theo dõi (Add to Library)
  playCount: number; // Tổng lượt nghe của playlist này

  // 5. Classification
  tags: string[];
  type: "playlist" | "album" | "radio" | "mix"; // Phân loại playlist
  publishAt: Date;
  // 6. Privacy & Settings
  visibility: "public" | "private" | "unlisted"; // Quyền riêng tư nâng cao
  isSystem: boolean; // Playlist do hệ thống tạo (Editor's Choice)

  createdAt: Date;
  updatedAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },

    // Slug unique kết hợp user (User A đặt tên "Chill" được, User B cũng đặt "Chill" được)
    // Hoặc xử lý slug unique global (thêm random string đuôi)
    slug: { type: String, required: true, unique: true },

    description: { type: String, default: "", maxlength: 1000 },

    coverImage: { type: String, default: "" }, // Nếu rỗng, FE tự tạo collage từ 4 bài đầu
    themeColor: { type: String, default: "#1db954" }, // Màu mặc định

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔥 TÍNH NĂNG COLLAB (Cho phép bạn bè cùng edit)
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],

    tracks: [{ type: Schema.Types.ObjectId, ref: "Track" }],

    // --- COUNTERS ---
    totalTracks: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    followersCount: { type: Number, default: 0, min: 0 }, // Thay likeCount bằng followersCount chuẩn hơn
    playCount: { type: Number, default: 0, min: 0 },

    tags: [{ type: String, trim: true }],

    // --- CLASSIFICATION ---
    type: {
      type: String,
      enum: ["playlist", "radio", "mix"], // Mix: Dạng Daily Mix do AI tạo
      default: "playlist",
    },
    publishAt: { type: Date, default: Date.now, index: true },
    // --- PRIVACY ---
    // Thay isPublic boolean bằng enum xịn hơn
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
      index: true,
    },

    isSystem: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- INDEXING STRATEGY ---

// 1. Text Search (Tìm kiếm)
PlaylistSchema.index({ title: "text", tags: "text" });

// 2. User Library (Lấy playlist của tôi)
PlaylistSchema.index({ user: 1, createdAt: -1 });

// 3. Explore / Trending (Tìm playlist Public, Hot nhất)
PlaylistSchema.index({
  visibility: 1,
  isSystem: 1,
  followersCount: -1,
});

// 4. Tìm playlist theo thể loại (Tags)
PlaylistSchema.index({ tags: 1, visibility: 1 });

export default mongoose.model<IPlaylist>("Playlist", PlaylistSchema);
