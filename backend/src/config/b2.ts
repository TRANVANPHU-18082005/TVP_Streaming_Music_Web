// src/config/b2.ts
import B2 from "backblaze-b2";
import dotenv from "dotenv";

dotenv.config();

// 1. Kiểm tra biến môi trường
const applicationKeyId = process.env.B2_KEY_ID || "";
const applicationKey = process.env.B2_APP_KEY || "";
const bucketId = process.env.B2_BUCKET_ID || "";
const bucketName = process.env.B2_BUCKET_NAME || "";

if (!applicationKeyId || !applicationKey || !bucketId || !bucketName) {
  console.warn("⚠️ B2 Credentials missing in .env");
}

// 2. Khởi tạo Instance
const b2 = new B2({
  applicationKeyId,
  applicationKey,
});

// 3. Hàm Health Check (Dùng cho Dashboard)
export const getB2Health = async () => {
  if (!applicationKeyId || !applicationKey) return null;

  try {
    // a. Authorize: Kiểm tra Key ID và App Key có hoạt động không
    await b2.authorize();

    // b. Get Bucket: Kiểm tra quyền truy cập vào Bucket cụ thể
    // (Lưu ý: API này nhẹ, không tốn phí Class C transaction nhiều như listFileNames)
    const res = await b2.getBucket({ bucketName, bucketId });

    return {
      status: "online" as const,
      bucketName: res.data.buckets[0].bucketName,
      bucketType: res.data.buckets[0].bucketType, // 'allPublic' hoặc 'allPrivate'
    };
  } catch (error: any) {
    console.error("❌ B2 Health Check Failed:", error.message);
    return {
      status: "offline" as const,
      bucketName: "Unknown",
      bucketType: "Unknown",
      error: error.message,
    };
  }
};

// 4. Export instance để dùng cho việc Upload/Delete ở các service khác
export default b2;
