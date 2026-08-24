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
  lastLogin?: Date;

  // Auth
  verificationCode?: string;
  verificationCodeExpires?: Date;
  authProvider: "local" | "google" | "facebook";
  googleId?: string;
  facebookId?: string;
  // Trong UserSchema

  // Relations
  artistProfile?: mongoose.Types.ObjectId;
  lastOtpSentAt: Date;
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
    lastOtpSentAt: { type: Date },

    // Auth Provider (Deprecated: Dùng UserIdentity collection thay thế)
    authProvider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    googleId: { type: String, index: true }, // Deprecated: chuyển sang UserIdentity
    facebookId: { type: String, index: true }, // Deprecated: chuyển sang UserIdentity

    artistProfile: { type: Schema.Types.ObjectId, ref: "Artist" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Virtual Relation: Lấy danh sách Identities của User
UserSchema.virtual("identities", {
  ref: "UserIdentity",
  localField: "_id",
  foreignField: "user_id",
});


// --- MIDDLEWARES ---
UserSchema.pre("save", async function (this: any) {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});
UserSchema.methods.matchPassword = async function (enteredPass: string) {
  return await bcrypt.compare(enteredPass, this.password as string);
};

export default mongoose.model<IUser>("User", UserSchema);
