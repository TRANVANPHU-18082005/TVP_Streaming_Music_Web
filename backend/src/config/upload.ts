import multer from "multer";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { b2Storage, cloudinaryStorage } from "./storage";

/**
 * A. UPLOAD TRACK (Hybrid: Audio + Cover -> B2)
 */
export const uploadTrackFiles = multer({
  storage: b2Storage, // Sử dụng B2 Storage Engine đã cấu hình
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB (High quality audio)
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "audio") {
      if (
        file.mimetype.startsWith("audio/") ||
        file.mimetype === "application/octet-stream"
      ) {
        cb(null, true);
      } else {
        cb(new ApiError(httpStatus.BAD_REQUEST, "File Audio không hợp lệ"));
      }
    } else if (file.fieldname === "coverImage") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new ApiError(httpStatus.BAD_REQUEST, "File Ảnh không hợp lệ"));
      }
    } else {
      cb(new ApiError(httpStatus.BAD_REQUEST, "Unexpected field"));
    }
  },
}).fields([
  { name: "audio", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

/**
 * B. UPLOAD IMAGES (Artist/User/Playlist -> Cloudinary)
 */
export const uploadImages = multer({
  storage: cloudinaryStorage, // Sử dụng Cloudinary Storage Engine
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Chỉ chấp nhận file ảnh (jpg, png, webp)"
        )
      );
    }
  },
});

// Helper Middlewares
export const uploadArtistFiles = uploadImages.fields([
  { name: "avatar", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
  { name: "gallery", maxCount: 5 },
]);

export const uploadUserAvatar = uploadImages.single("avatar");
