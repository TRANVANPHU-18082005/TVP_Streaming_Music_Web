import { z } from "zod";
import { becomeArtistSchema } from "../schemas/verification.schema";

// --- 1. COMMON TYPES ---

export type VerificationStatus = "pending" | "approved" | "rejected";

/**
 * Type rút gọn của User khi được populate trong Request
 */
export interface RequestUser {
  _id: string;
  fullName: string;
  email: string;
  avatar: string;
}

// --- 2. DATA MODEL (ENTITY) ---
// Dùng để hiển thị danh sách trong trang Admin
export interface VerificationRequest {
  _id: string;
  user: RequestUser; // Backend đã populate

  // Thông tin Artist
  artistName: string;
  artistId?: string; // Có giá trị nếu claim profile cũ

  // Thông tin pháp lý
  realName: string;
  emailWork: string;
  socialLinks: string[];
  idCardImages: string[]; // Mảng 2 URL ảnh từ Cloudinary

  // Trạng thái xử lý
  status: VerificationStatus;
  rejectReason?: string;

  createdAt: string; // ISO Date String
  updatedAt: string;
}

// --- 3. FORM TYPES (INPUT) ---

// Admin Filter Params
export interface VerificationFilterParams {
  page: number;
  limit: number;
  status: VerificationStatus;
}

// Admin Review Payload
export interface ReviewPayload {
  id: string;
  status: "approved" | "rejected";
  rejectReason?: string;
}

// --- 5. API RESPONSE WRAPPERS ---

export interface VerificationListResponse {
  requests: VerificationRequest[];
  total: number;
  page: number;
  limit: number;
}
