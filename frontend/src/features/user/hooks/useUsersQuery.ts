import { useQuery, keepPreviousData } from "@tanstack/react-query";
import userApi from "../api/userApi";
import { userKeys } from "../utils/userKeys";
import type { UserFilterParams } from "../types";

// ==========================================
// 1. QUERY: LẤY THỐNG KÊ USERS (ADMIN)
// ==========================================
export const useUserStatsQuery = () => {
  return useQuery({
    queryKey: ["users-stats"],
    queryFn: () => userApi.getStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (response) => response.data,
  });
};

// ==========================================
// 2. QUERY: LẤY DANH SÁCH USERS (ADMIN)
// ==========================================
export const useUsersQuery = (params: UserFilterParams) => {
  return useQuery({
    // Sử dụng userKeys đã định nghĩa để quản lý cache key đồng nhất
    queryKey: userKeys.list(params),
    queryFn: () => userApi.getAll(params),

    // UX: Giữ hiển thị dữ liệu cũ trong lúc fetch trang mới (tránh UI bị giật/chớp)
    placeholderData: keepPreviousData,

    // Tối ưu hóa: Cache dữ liệu trong 1 phút. Trong 1 phút nếu user quay lại trang, sẽ hiện ngay data từ cache.
    staleTime: 1000 * 60,

    // Selector: Chỉ trích xuất những dữ liệu thực sự cần thiết cho Component (Table, Pagination)
    select: (response) => ({
      users: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

// ==========================================
// 2. QUERY: LẤY CHI TIẾT 1 USER (ADMIN / PROFILE)
// ==========================================
export const useUserDetailQuery = (userId: string | undefined | null) => {
  return useQuery({
    // Nếu userId bị undefined/null (VD: form tạo mới), queryKey sẽ thay đổi nhưng enabled = false sẽ chặn fetch
    queryKey: userKeys.detail(userId as string),
    queryFn: () => userApi.getById(userId as string),

    // Chỉ gọi API khi thực sự có ID truyền vào
    enabled: !!userId,

    // Cache lâu hơn 1 chút cho trang chi tiết
    staleTime: 1000 * 60 * 5,

    select: (response) => response.data,
  });
};

// ==========================================
// 3. QUERY: LẤY DANH SÁCH YÊU CẦU LÊN ARTIST
// ==========================================
export const useArtistRequestsQuery = () => {
  return useQuery({
    // Key riêng cho artist requests
    queryKey: ["artist-requests", "list"],
    queryFn: () => userApi.getArtistRequests(),

    // Thường dữ liệu duyệt đơn cần tính real-time cao hơn
    staleTime: 1000 * 30, // 30s

    select: (response) => ({
      requests: response.data,
      isEmpty: response.data.length === 0,
      // Tính toán badge notifications (Số lượng đơn đang chờ)
      pendingCount: response.data.filter((req) => req.status === "pending")
        .length,
    }),
  });
};
