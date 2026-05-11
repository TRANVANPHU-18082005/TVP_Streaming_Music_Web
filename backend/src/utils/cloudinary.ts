import { v2 as cloudinary } from "cloudinary";
import config from "../config/env";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Helper: Trích xuất Public ID từ URL đầy đủ
 * Input: https://res.cloudinary.com/.../upload/v123/music-app/tracks/bai-hat/audio.mp3
 * Output: music-app/tracks/bai-hat/audio
 */
const getPublicIdFromUrl = (url: string): string | null => {
  try {
    // Regex tìm phần sau /upload/ (bỏ qua version v...) và bỏ đuôi file
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    console.warn("Could not extract publicId from URL:", url);
    return null;
  }
};

/**
 * 1. XÓA FILE LẺ
 * Dùng cho: Playlist Cover, User Avatar, Banner...
 * @param url Link ảnh/file trên Cloudinary
 * @param resourceType Loại file ('image' | 'video' | 'raw'). Lưu ý: Audio là 'video'.
 */
export const deleteFileFromCloud = async (
  url: string | undefined | null,
  resourceType: "image" | "video" | "raw" = "image"
) => {
  if (!url) return;

  // An toàn: Không xóa ảnh default hoặc ảnh không phải của Cloudinary
  if (url.includes("default") || !url.includes("cloudinary")) {
    return;
  }

  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log(
      `[Cloudinary] Deleted file (${resourceType}): ${publicId} -> ${result.result}`
    );
  } catch (error) {
    console.error(`[Cloudinary] Error deleting file ${publicId}:`, error);
  }
};

/**
 * 2. XÓA NGUYÊN FOLDER BÀI HÁT
 * Dùng cho: Xóa Track hoặc Update file nhạc mới (xóa folder cũ đi)
 * Logic: Cloudinary bắt buộc phải xóa sạch file bên trong trước khi xóa được folder.
 * @param fileUrl Bất kỳ link file nào nằm trong folder đó (thường là trackUrl)
 */
export const deleteTrackFolder = async (fileUrl: string | undefined | null) => {
  if (!fileUrl) return;

  // 1. Lấy Public ID của file (VD: music-app/tracks/son-tung/audio)
  const publicId = getPublicIdFromUrl(fileUrl);
  if (!publicId) return;

  // 2. Lấy đường dẫn folder (VD: music-app/tracks/son-tung)
  // Logic: Cắt bỏ phần tên file cuối cùng
  const folderPath = publicId.substring(0, publicId.lastIndexOf("/"));

  // Check an toàn: Chỉ xóa folder nằm trong 'tracks' để tránh xóa nhầm folder gốc
  if (!folderPath.includes("tracks/")) {
    console.warn(
      `[Cloudinary] Skipped deleting folder (safety check): ${folderPath}`
    );
    return;
  }

  try {
    console.log(`[Cloudinary] Start deleting folder: ${folderPath}`);

    // Bước A: Xóa sạch các tài nguyên bên trong (Image, Video/Audio, Raw)
    // Audio nằm ở resource_type: 'video'
    await cloudinary.api.delete_resources_by_prefix(folderPath + "/", {
      resource_type: "video",
    });
    await cloudinary.api.delete_resources_by_prefix(folderPath + "/", {
      resource_type: "image",
    });
    await cloudinary.api.delete_resources_by_prefix(folderPath + "/", {
      resource_type: "raw",
    });

    // Bước B: Xóa chính cái folder rỗng
    await cloudinary.api.delete_folder(folderPath);

    console.log(`[Cloudinary] Deleted folder successfully: ${folderPath}`);
  } catch (error) {
    // Chỉ log lỗi, không throw để tránh crash luồng chính
    console.error(`[Cloudinary] Error deleting folder ${folderPath}:`, error);
  }
};
