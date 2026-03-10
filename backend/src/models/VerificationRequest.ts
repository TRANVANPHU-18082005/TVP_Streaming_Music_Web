import mongoose, { Schema, Document } from "mongoose";

export interface IVerificationRequest extends Document {
  user: mongoose.Types.ObjectId; // User nào gửi yêu cầu

  // Thông tin Artist muốn Claim/Tạo
  artistName: string; // Tên nghệ danh
  artistId?: mongoose.Types.ObjectId; // (Optional) Nếu claim profile đã có sẵn trên hệ thống

  // Bằng chứng xác thực
  realName: string;
  idCardImages: string[]; // Ảnh CCCD 2 mặt (Lưu URL Cloudinary)
  socialLinks: string[]; // Facebook, Instagram chính chủ
  emailWork: string; // Email công việc

  status: "pending" | "approved" | "rejected";
  rejectReason?: string; // Lý do từ chối (nếu có)

  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    artistName: { type: String, required: true },
    artistId: { type: Schema.Types.ObjectId, ref: "Artist" }, // Null nếu tạo mới

    realName: { type: String, required: true },
    idCardImages: [{ type: String, required: true }],
    socialLinks: [{ type: String }],
    emailWork: { type: String },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true, // Index để Admin lọc nhanh đơn chưa duyệt
    },
    rejectReason: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IVerificationRequest>(
  "VerificationRequest",
  VerificationRequestSchema
);
