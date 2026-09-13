// models/RoomMessage.ts

import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MessageType = "text" | "reaction" | "system";

export interface IRoomMessage extends Document {
  room: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;   // undefined nếu là system message
  senderName: string;                 // Cache tránh populate
  senderAvatar: string;               // Cache tránh populate
  content: string;
  type: MessageType;
  reaction?: string;                  // Emoji nếu type = "reaction"
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const RoomMessageSchema = new Schema<IRoomMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "MusicRoom",
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", default: null },
    senderName: { type: String, required: true, trim: true, maxlength: 50 },
    senderAvatar: { type: String, default: "" },
    content: { type: String, required: true, trim: true, maxlength: 300 },
    type: {
      type: String,
      enum: ["text", "reaction", "system"],
      default: "text",
      index: true,
    },
    reaction: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Chỉ cần createdAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// Query lịch sử chat: lấy N tin nhắn gần nhất của một phòng
RoomMessageSchema.index({ room: 1, createdAt: -1 });

// Cleanup cron: xóa tin nhắn cũ hơn 7 ngày
RoomMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export default mongoose.model<IRoomMessage>("RoomMessage", RoomMessageSchema);
