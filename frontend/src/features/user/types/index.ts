// 1. User Entity (Khớp với Model Mongo)
export interface IUser {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  role: "user" | "artist" | "admin";
  avatar?: string;
  bio?: string;
  isActive: boolean;
  isVerified: boolean;

  // Relations (Chỉ lấy count hoặc ID)
  followersCount?: number;
  followingCount?: number;
  isFollowed?: boolean; // Backend trả về cờ này
  authProvider?: "local" | "google";
  mustChangePassword: boolean;
  createdAt: string;
}
export interface UserProfile {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  role: "user" | "artist" | "admin";
  avatar?: string;
  bio?: string;
  isActive: boolean;
  isVerified: boolean;

  authProvider?: "local" | "google";
  mustChangePassword: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: "user" | "artist" | "admin";
  avatar?: File | null;
  bio?: string;
}
export interface UpdateUserRequest {
  fullName: string;
  email: string;
  role: "user" | "artist" | "admin";
  avatar?: File | null;
  bio?: string;
}

// 2. Artist Request Entity
export interface ArtistRequest {
  _id: string;
  user: IUser;
  stageName: string;
  bio?: string;
  avatar?: string;
  genres: string[];
  socialLinks: string[];
  demoLink?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// 3. DTOs (Data Transfer Objects)
export interface UpdateProfileDTO {
  fullName: string;
  bio?: string;
  avatar?: File | null; // Để upload
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface RequestArtistDTO {
  stageName: string;
  bio: string;
  genres: string[]; // Frontend gửi mảng string
  socialLinks: string[];
  demoLink: string;
  avatar?: File | null;
}

// 4. Admin Filter Params
export interface UserFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  sort?: string;
  role?: string;
  isVerified?: boolean;
  isActive?: boolean;
}
