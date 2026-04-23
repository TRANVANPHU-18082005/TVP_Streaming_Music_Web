export const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
};
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (num: number) => {
  if (!num) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
};
// utils/format.ts hoặc để ngay trên cùng file component
export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
import { IArtist } from "@/features/artist/types";

/**
 * Format danh sách nghệ sĩ thành chuỗi hiển thị đẹp mắt.
 * VD: "Sơn Tùng M-TP" hoặc "Sơn Tùng M-TP feat. Mono, Low G"
 */
export const formatArtistDisplay = (
  primary: IArtist | undefined | null,
  featuring: IArtist[] = [],
  options: { includeFeat?: boolean } = { includeFeat: true },
): string => {
  if (!primary) return "Unknown Artist";

  const primaryName = primary.name || "Unknown Artist";

  // Lọc featuring để tránh trùng với primary (phòng trường hợp data lỗi)
  const validFeat = featuring.filter((f) => f && f._id !== primary._id);

  if (validFeat.length === 0) return primaryName;

  const featNames = validFeat.map((f) => f.name).join(", ");

  return options.includeFeat
    ? `${primaryName} feat. ${featNames}`
    : `${primaryName}, ${featNames}`;
};
/**
 * Trả về mảng nghệ sĩ đã được làm sạch và loại bỏ trùng lặp
 */
export const getCleanArtistList = (
  primary: IArtist,
  featuring: IArtist[] = [],
): IArtist[] => {
  // Loại bỏ các phần tử lỗi hoặc trùng với primary
  const uniqueFeat = featuring.filter((f) => f && f._id !== primary._id);
  return [primary, ...uniqueFeat];
};
