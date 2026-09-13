// models/MusicRoom.ts

import mongoose, { Schema, Document } from "mongoose";
import { customAlphabet } from "nanoid";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RoomTheme = "bar" | "lounge" | "festival" | "chill" | "hype";

export interface IQueueItem {
  track: mongoose.Types.ObjectId;
  addedBy: mongoose.Types.ObjectId;
  addedAt: Date;
  votes: number;
  voters: mongoose.Types.ObjectId[];
}

export interface IMusicRoom extends Document {
  roomCode: string;       // Mã phòng 6 ký tự (uppercase)
  name: string;
  description?: string;
  coverImage?: string;
  theme: RoomTheme;

  // Host & quyền
  host: mongoose.Types.ObjectId;
  isPublic: boolean;
  maxMembers: number;     // 20 (private) | 50 (public)
  password?: string;      // Chỉ có khi isPublic = false
  mutedUsers: mongoose.Types.ObjectId[]; // Danh sách user bị cấm chat

  // Trạng thái
  isActive: boolean;
  memberCount: number;    // Cache từ Redis, cập nhật khi join/leave

  // Queue bài hát
  queue: IQueueItem[];

  // Trạng thái phát nhạc (để người join sau sync được ngay)
  currentTrack?: mongoose.Types.ObjectId;
  currentMoodVideo?: mongoose.Types.ObjectId; // Video nền trình chiếu cho listener
  currentTrackIndex: number;
  startedAt?: Date;       // UTC timestamp khi bắt đầu phát bài hiện tại
  isPaused: boolean;
  pausedAt?: number;      // Vị trí dừng tính bằng giây

  // Timestamps
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const QueueItemSchema = new Schema<IQueueItem>(
  {
    track: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedAt: { type: Date, default: Date.now },
    votes: { type: Number, default: 0 },
    voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const MusicRoomSchema = new Schema<IMusicRoom>(
  {
    roomCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 300 },
    coverImage: { type: String, default: "" },
    theme: {
      type: String,
      enum: ["bar", "lounge", "festival", "chill", "hype"],
      default: "bar",
    },

    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPublic: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 50, min: 2, max: 100 },
    password: { type: String, select: false },
    mutedUsers: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    memberCount: { type: Number, default: 0, min: 0 },

    queue: { type: [QueueItemSchema], default: [] },

    currentTrack: {
      type: Schema.Types.ObjectId,
      ref: "Track",
      default: null,
    },
    currentMoodVideo: {
      type: Schema.Types.ObjectId,
      ref: "TrackMoodVideo",
      default: null,
    },
    currentTrackIndex: { type: Number, default: -1 },
    startedAt: { type: Date, default: null },
    isPaused: { type: Boolean, default: false },
    pausedAt: { type: Number, default: 0 },

    lastActivityAt: { type: Date, default: Date.now, index: true },
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

MusicRoomSchema.index({ isPublic: 1, isActive: 1, memberCount: -1 });
MusicRoomSchema.index({ host: 1, isActive: 1 });
// TTL-like: cleanup job sẽ dùng lastActivityAt
MusicRoomSchema.index({ lastActivityAt: 1, isActive: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE: Auto generate roomCode nếu chưa có
// ─────────────────────────────────────────────────────────────────────────────

MusicRoomSchema.pre("validate", async function () {
  if (this.isNew && !this.roomCode) {
    // Thử tạo roomCode unique, tối đa 5 lần
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const exists = await mongoose
        .model("MusicRoom")
        .exists({ roomCode: code });
      if (!exists) break;
      attempts++;
    } while (attempts < 5);
    this.roomCode = code!;
  }
});

export default mongoose.model<IMusicRoom>("MusicRoom", MusicRoomSchema);
