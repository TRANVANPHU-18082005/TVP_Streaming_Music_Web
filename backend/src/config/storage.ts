import { v2 as cloudinary } from "cloudinary";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multerS3 from "multer-s3";
import path from "path";
import slugify from "slugify";
import config from "./env";

// ========================================================================
// 1. KHỞI TẠO CLIENT
// ========================================================================

cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const s3 = new S3Client({
  endpoint: config.b2.endpoint,
  region: config.b2.region || "us-west-004",
  credentials: {
    accessKeyId: config.b2.keyId as string,
    secretAccessKey: config.b2.appKey as string,
  },
  forcePathStyle: false,
});

// ========================================================================
// 2. HELPER: FIX ENCODING & SLUG GENERATOR
// ========================================================================

/**
 * Fix lỗi font tiếng Việt: Multer mặc định đọc originalname theo Latin1.
 * Cần chuyển về UTF-8 trước khi đưa vào slugify.
 */
const getSafeSlug = (text: string) => {
  if (!text) return `file-${Date.now()}`;

  // Bước 1: Decode Latin1 to UTF-8 để tránh lỗi "chaong ta"
  const decodedText = Buffer.from(text, "latin1").toString("utf8");

  // Bước 2: Slugify với locale tiếng Việt
  return slugify(decodedText, {
    lower: true,
    strict: true,
    locale: "vi",
    trim: true,
  });
};

// ========================================================================
// 3. STORAGE ENGINES
// ========================================================================

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = "music-app/images";
    let transformation: any[] = [{ width: 1000, crop: "limit" }];

    if (file.fieldname === "avatar") {
      folderName = "music-app/avatars";
      transformation = [
        { width: 500, height: 500, crop: "fill", gravity: "face" },
      ];
    } else if (file.fieldname === "coverImage") {
      folderName = "music-app/covers";
    }

    const publicId = `${getSafeSlug(path.parse(file.originalname).name)}-${Date.now()}`;

    return {
      folder: folderName,
      resource_type: "image",
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      public_id: publicId,
      transformation: transformation,
    };
  },
});

// Thêm vào file storage.ts của Phú
const cloudinaryVideoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      resource_type: "video",
      folder: "mood_videos",
      // BỎ gravity: "auto" ở đây
      transformation: [
        {
          width: 720,
          height: 1280,
          crop: "limit", // Sử dụng "limit" hoặc "fit" thay vì "fill" có g_auto
          fetch_format: "mp4",
          quality: "auto",
        },
      ],
      public_id: `mood-${Date.now()}`,
    };
  },
});

const b2Storage = multerS3({
  s3: s3,
  bucket: config.b2.bucketName as string,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  acl: "public-read",
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req: any, file, cb) => {
    // 1. Xử lý tên file và title an toàn
    const fileNameDecoded = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    const rawTitle = req.body.title || path.parse(fileNameDecoded).name;

    // Tạo slug chung cho cả bài hát
    const trackSlug = getSafeSlug(rawTitle);

    // 2. Đảm bảo Folder vật lý là duy nhất cho mỗi request upload
    if (!req.uniqueTrackFolder) {
      req.uniqueTrackFolder = `${trackSlug}-${Date.now()}`;
    }

    const isAudio = file.mimetype.startsWith("audio");
    const typeFolder = isAudio ? "audio" : "covers";
    const ext = path.extname(file.originalname).toLowerCase();

    // 3. Đặt tên file theo slug (tránh ký tự lạ, dấu cách)
    // Audio: tracks/slug-timestamp/audio/slug.mp3
    // Cover: tracks/slug-timestamp/covers/slug.jpeg
    const finalPath = `tracks/${req.uniqueTrackFolder}/${typeFolder}/${trackSlug}${ext}`;

    cb(null, finalPath);
  },
});

export { s3, cloudinary, cloudinaryStorage, cloudinaryVideoStorage, b2Storage };
