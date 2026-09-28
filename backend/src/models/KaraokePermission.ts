// models/KaraokePermission.ts
//
// Admin cấp quyền upload karaoke cho user — thay cho hệ thống subscription phức tạp.
// Mỗi user tối đa có 1 document KaraokePermission.

import mongoose, { Schema, Document } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface IKaraokePermission extends Document {
  user: mongoose.Types.ObjectId;

  // Upload control
  uploadEnabled: boolean;     // Admin bật/tắt quyền upload
  uploadLimit: number;        // Số recordings tối đa được upload (-1 = unlimited)
  uploadsUsed: number;        // Số recordings đã upload
  maxDuration: number;        // Thời lượng tối đa mỗi recording (giây), 0 = unlimited
  maxFileSize: number;        // Kích thước tối đa mỗi file (bytes), 0 = unlimited

  // Admin info
  grantedBy: mongoose.Types.ObjectId;  // Admin cấp quyền
  grantedAt: Date;
  revokedAt?: Date;           // Thời điểm thu hồi (nếu có)
  note?: string;              // Ghi chú admin

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const KaraokePermissionSchema = new Schema<IKaraokePermission>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Mỗi user chỉ có 1 permission record
    },

    // Upload control
    uploadEnabled: { type: Boolean, default: false },
    uploadLimit: { type: Number, default: 5, min: -1 },    // -1 = unlimited
    uploadsUsed: { type: Number, default: 0, min: 0 },
    maxDuration: { type: Number, default: 600, min: 0 },   // 10 phút mặc định, 0 = unlimited
    maxFileSize: {
      type: Number,
      default: 50 * 1024 * 1024, // 50MB mặc định
      min: 0,                    // 0 = unlimited
    },

    // Admin info
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    note: { type: String, default: "", maxlength: 500 },
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

KaraokePermissionSchema.index({ uploadEnabled: 1 });
KaraokePermissionSchema.index({ grantedBy: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

/** Còn bao nhiêu lượt upload? */
KaraokePermissionSchema.virtual("uploadsRemaining").get(function () {
  if (this.uploadLimit === -1) return Infinity;
  return Math.max(0, this.uploadLimit - this.uploadsUsed);
});

/** Đã hết quota chưa? */
KaraokePermissionSchema.virtual("isQuotaExhausted").get(function () {
  if (this.uploadLimit === -1) return false;
  return this.uploadsUsed >= this.uploadLimit;
});

export default mongoose.model<IKaraokePermission>("KaraokePermission", KaraokePermissionSchema);
