import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  fullName: string;
  username: string;
  email: string;
  password?: string;
  role: "user" | "artist" | "admin";
  avatar: string;
  bio: string;

  // Status
  isActive: boolean;
  isVerified: boolean;
  mustChangePassword: boolean;
  lastLogin?: Date; // 🔥 Thêm cái này để track user active

  // Auth
  verificationCode?: string;
  verificationCodeExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshToken?: string;
  authProvider: "local" | "google";
  googleId?: string;
  // Trong UserSchema

  // Relations
  artistProfile?: mongoose.Types.ObjectId;

  // Liked Tracks thì OK vì user hiếm khi like quá 10.000 bài (vẫn nhẹ chán)
  likedTracks: mongoose.Types.ObjectId[];
  lastOtpSentAt: Date;

  // ❌ ĐÃ XÓA followers & following (Chuyển sang model Follow)

  matchPassword(enteredPass: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 50 },

    username: {
      type: String,
      unique: true,
      sparse: true, // Cho phép null (dùng cho login Google)
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      // Validate Email
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Email không hợp lệ",
      ],
    },

    password: { type: String, select: false },
    role: { type: String, enum: ["user", "artist", "admin"], default: "user" },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 500 },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    lastLogin: { type: Date },

    // Auth Tokens
    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    lastOtpSentAt: { type: Date },

    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, index: true }, // Index để tìm user Google nhanh

    artistProfile: { type: Schema.Types.ObjectId, ref: "Artist" },
    likedTracks: [{ type: Schema.Types.ObjectId, ref: "Track" }],
  },
  { timestamps: true }
);

// --- MIDDLEWARES ---
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});
UserSchema.methods.matchPassword = async function (enteredPass: string) {
  return await bcrypt.compare(enteredPass, this.password as string);
};

export default mongoose.model<IUser>("User", UserSchema);
