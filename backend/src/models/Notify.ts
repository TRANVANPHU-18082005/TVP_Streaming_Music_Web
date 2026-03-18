// src/models/Notify.ts
import mongoose, { Schema, Document } from "mongoose";

export interface INotify extends Document {
  recipientId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  type: "NEW_TRACK" | "SYSTEM" | "LIKE_TRACK";
  relatedId?: mongoose.Types.ObjectId;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
}

const NotifySchema = new Schema(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "Artist", required: true },
    type: {
      type: String,
      enum: ["NEW_TRACK", "SYSTEM", "LIKE_TRACK"],
      default: "NEW_TRACK",
    },
    relatedId: { type: Schema.Types.ObjectId },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: true },
);

// Tự động xóa sau 30 ngày để tối ưu DB
NotifySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model<INotify>("Notify", NotifySchema);
