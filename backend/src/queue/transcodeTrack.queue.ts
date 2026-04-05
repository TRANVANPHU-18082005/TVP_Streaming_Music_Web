import { Queue } from "bullmq";
import { queueRedis } from "../config/redis";

// Khởi tạo Queue
export const audioQueue = new Queue("audio-transcoding", {
  connection: queueRedis,
});

interface TranscodeJobData {
  trackId: string;
  fileUrl: string;
}

export const addTranscodeJob = async (data: TranscodeJobData) => {
  await audioQueue.add("transcode", data, {
    // 1. Chế độ thử lại thông minh
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // Thử lại sau 5s, 10s, 20s...
    },

    // 2. Tự động dọn dẹp Job THÀNH CÔNG
    // Xóa ngay lập tức để tiết kiệm RAM Redis Cloud
    removeOnComplete: {
      count: 10, // Nếu muốn giữ lại vài job thành công để xem lịch sử thì dùng object này
      age: 3600, // Xóa sau 1 giờ
    },

    // 3. Tự động dọn dẹp Job THẤT BẠI (Quan trọng)
    // Thay vì để false (lưu mãi mãi), ta giới hạn:
    removeOnFail: {
      count: 20, // Chỉ giữ lại 20 Job lỗi gần nhất để xem log
      age: 24 * 3600, // Hoặc xóa Job lỗi sau 24 giờ
    },
  });

  console.log(`📥 [Producer] Job added: Track ${data.trackId}`);
};
