// src/models/ListenLog.ts
import mongoose, { Schema } from "mongoose";

const ListenLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  trackId: { type: Schema.Types.ObjectId, ref: "Track", index: true },
  listenedAt: { type: Date, default: Date.now },
});

// Index TTL: Tự động xóa log sau 90 ngày để DB không bị phình quá to
ListenLogSchema.index({ listenedAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("ListenLog", ListenLogSchema);
