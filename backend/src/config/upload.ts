import { Request, Response, NextFunction } from "express-serve-static-core";
import multer from "multer";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
// ... các dòng import storage giữ nguyên
import {
  b2Storage,
  cloudinaryStorage,
  cloudinaryVideoStorage,
} from "./storage";

/**
 * A. UPLOAD TRACK (Hybrid: Audio + Cover -> B2)
 */
const multerTrackFiles = multer({
  storage: b2Storage,
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
 * 🚀 CUSTOM MIDDLEWARE CHỐT CHẶN (Vá lỗi load thiếu file Audio)
 * Middleware này bọc ngoài lõi Multer để đảm bảo đồng bộ luồng tải file 100%
 */
export const uploadTrackFiles = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  multerTrackFiles(req, res, (err) => {
    if (err) return next(err); // Nếu bẫy filter hoặc limit quá dung lượng ném lỗi ngay

    // Kiểm tra xem req.files có tồn tại không
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // 🎯 CHỐT CHẶN VÀNG: Kiểm tra xem file audio thực sự đã được upload stream lên B2 hoàn tất chưa
    if (!files || !files["audio"] || files["audio"].length === 0) {
      return next(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Thiếu file Audio hoặc file chưa tải xong",
        ),
      );
    }

    // Mẹo chuẩn hóa: Trích xuất file đầu tiên trong mảng fields ra để ép kiểu phẳng cho Controller dễ đọc
    (req as any).audioFile = files["audio"][0];
    if (files["coverImage"] && files["coverImage"].length > 0) {
      (req as any).coverImageFile = files["coverImage"][0];
    }

    next(); // Toàn bộ file đã nằm yên trên mây an toàn, mở cửa cho Service chạy!
  });
};

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
          "Chỉ chấp nhận file ảnh (jpg, png, webp)",
        ),
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

// Trong file upload.ts, xuất thêm middleware này
export const uploadVideoCanvas = multer({
  storage: cloudinaryVideoStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Giới hạn 20MB
}).single("video");

export const uploadUserAvatar = uploadImages.single("avatar");
