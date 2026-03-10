import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { cloudinary, s3 } from "../config/storage";

// 1. CLOUDINARY CLEANUP
export const deleteFromCloudinary = async (publicIdOrUrl: string) => {
  if (!publicIdOrUrl) return;

  try {
    let publicId = publicIdOrUrl;

    if (publicIdOrUrl.startsWith("http")) {
      // Logic regex chuẩn hơn để lấy public_id từ URL Cloudinary
      const regex = /\/v\d+\/([^/]+)\.[a-z]+$|upload\/(?:v\d+\/)?(.+)\.[a-z]+$/;
      const matches = publicIdOrUrl.match(regex);
      publicId = matches ? matches[1] || matches[2] : publicIdOrUrl;
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result === "ok") {
      console.log(`✅ [Cloudinary] Deleted: ${publicId}`);
    }
  } catch (error) {
    console.error(`❌ [Cloudinary] Error deleting:`, error);
  }
};

// 2. BACKBLAZE B2 CLEANUP
export const deleteFromB2 = async (key: string) => {
  if (!key) return;
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });
    await s3.send(command);
    console.log(`✅ [B2] Deleted File: ${key}`);
  } catch (error) {
    console.error(`❌ [B2] Error deleting file (${key}):`, error);
  }
};

export const deleteFolderFromB2 = async (prefix: string) => {
  if (!prefix) return;
  const folderPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: folderPrefix,
    });

    const listResult = await s3.send(listCommand);
    if (!listResult.Contents || listResult.Contents.length === 0) return;

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Delete: {
        Objects: listResult.Contents.map((obj) => ({ Key: obj.Key })),
        Quiet: true,
      },
    });

    await s3.send(deleteCommand);
    console.log(
      `✅ [B2] Purged Folder: ${folderPrefix} (${listResult.Contents.length} items)`,
    );
  } catch (error) {
    console.error(`❌ [B2] Error purging folder (${folderPrefix}):`, error);
  }
};
