import { Types } from "mongoose";
import { subDays, format, eachDayOfInterval } from "date-fns";
import { ChartData } from "../dtos/dashboard.dto";
export const parseGenreIds = (input: any): Types.ObjectId[] => {
  if (!input || input === "null" || input === "undefined") return [];

  let parsedData;
  try {
    // Nếu là string JSON '["id1", "id2"]' -> Parse
    parsedData =
      typeof input === "string" && input.startsWith("[")
        ? JSON.parse(input)
        : input;
  } catch (e) {
    parsedData = input; // Fallback
  }

  // Đảm bảo luôn là mảng
  const idArray = Array.isArray(parsedData) ? parsedData : [parsedData];

  // Filter & Convert ObjectId
  return idArray
    .filter((id: string) => Types.ObjectId.isValid(id))
    .map((id: string) => new Types.ObjectId(id));
};
export const parseTags = (input: any): string[] => {
  if (!input || input === "null" || input === "undefined") return [];

  let parsedData = input;

  // 1. Try JSON Parse first (if it looks like an array)
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        parsedData = JSON.parse(trimmed);
      } catch (e) {
        parsedData = []; // Or fallback
      }
    } else if (trimmed.includes(",")) {
      // Handle comma separated: "tag1, tag2"
      parsedData = trimmed.split(",");
    } else {
      // Single string
      parsedData = [trimmed];
    }
  }

  // 2. Ensure Array
  const tagArray = Array.isArray(parsedData) ? parsedData : [parsedData];

  // 3. Clean: Trim, Filter empty
  return tagArray
    .map((tag: any) => String(tag).trim())
    .filter((tag: string) => tag.length > 0);
};
// --- 2. HELPER FUNCTIONS (Tính toán phụ trợ) ---

// Tính % tăng trưởng: ((Mới - Cũ) / Cũ) * 100
export const calculateGrowth = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};
export const fillMissingDates = (
  data: { _id: string; count: number }[],
  days: number
): ChartData[] => {
  const endDate = new Date();
  const startDate = subDays(endDate, days - 1); // Trừ days-1 để tính cả hôm nay

  // Tạo danh sách tất cả các ngày trong khoảng
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // Tạo Map để tra cứu nhanh: "2024-05-20" => 10
  // Dùng Map giúp độ phức tạp giảm từ O(N^2) xuống O(N)
  const dataMap = new Map(data.map((item) => [item._id, item.count]));

  return dateRange.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      _id: dateStr, // 🔥 SỬA: Đổi 'date' thành '_id' cho khớp DTO
      count: dataMap.get(dateStr) || 0, // 🔥 SỬA: Đổi 'value' thành 'count' cho khớp DTO
    };
  });
};
// src/utils/helper.ts

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// 2. Hàm tính phần trăm an toàn
export const calculatePercent = (used: number, limit: number) => {
  // Nếu không có limit hoặc limit = 0 thì trả về 0 để tránh chia cho 0
  if (!limit || limit === 0) return 0;

  const percent = (used / limit) * 100;
  // Giới hạn max 100% để giao diện không bị vỡ
  return Number(Math.min(percent, 100).toFixed(2));
};
