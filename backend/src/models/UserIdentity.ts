import mongoose, { Schema, Document } from "mongoose";

export type AuthProviderType =
  | "password"
  | "google"
  | "facebook"
  | "github"
  | "apple"
  | "microsoft";

export interface IUserIdentity extends Document {
  user_id: mongoose.Types.ObjectId;
  provider: AuthProviderType;
  provider_user_id: string; // ID định danh duy nhất từ nhà cung cấp (OAuth ID hoặc email đối với password)
  provider_email: string;
  provider_email_verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserIdentitySchema = new Schema<IUserIdentity>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["password", "google", "facebook", "github", "apple", "microsoft"],
      required: true,
    },
    provider_user_id: {
      type: String,
      required: true,
    },
    provider_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    provider_email_verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: Đảm bảo một provider_user_id không bị gán cho 2 user khác nhau trong cùng 1 provider
UserIdentitySchema.index({ provider: 1, provider_user_id: 1 }, { unique: true });

// Compound index cho việc truy vấn tất cả identity của 1 user nhanh chóng
UserIdentitySchema.index({ user_id: 1, provider: 1 });

export default mongoose.model<IUserIdentity>("UserIdentity", UserIdentitySchema);
