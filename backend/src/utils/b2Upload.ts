import fs from "fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config/storage"; // Import client S3 đã cấu hình ở bước trước
import dotenv from "dotenv";

dotenv.config();

/**
 * Upload file từ Local lên Backblaze B2
 */
export const uploadToB2 = async (
  localFilePath: string,
  fileName: string,
  targetFolder: string
) => {
  const fileStream = fs.createReadStream(localFilePath);

  // 🔥 QUAN TRỌNG: Set Content-Type để trình duyệt/player hiểu
  let contentType = "application/octet-stream";
  if (fileName.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
  else if (fileName.endsWith(".ts")) contentType = "video/MP2T";

  const key = `${targetFolder}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  });

  await s3.send(command);

  // Trả về Key (đường dẫn) để sau này ghép với domain CDN
  return key;
};
