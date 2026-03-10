import { z } from "zod";
import {
  updateProfileSchema,
  changePasswordSchema,
  getUsersSchema,
  adminCreateUserSchema,
} from "../validations/user.validation";

// Input DTOs
export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>["body"];
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>["body"];
export type UserFilterDTO = z.infer<typeof getUsersSchema>["query"];
export type AdminUpdateUserDTO = z.infer<typeof adminCreateUserSchema>["body"];

// Response DTO (User Public Profile)
export interface UserProfileDTO {
  _id: string;
  fullName: string;
  username: string;
  avatar: string;
  bio?: string;
  role: string;
  isVerified: boolean;
  // Các field quan hệ
  artistProfile?: string | object;
  followingCount?: number; // Nếu có tính toán
}
