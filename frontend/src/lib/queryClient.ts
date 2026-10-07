// src/lib/react-query.ts
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleError } from "@/utils/handleError";
import { parseApiError } from "@/utils/apiError";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** true: không toast khi refetch nền thất bại */
      silent?: boolean;
    };
    mutationMeta: {
      /** true: bỏ qua toast lỗi toàn cục (caller tự xử lý) */
      skipGlobalError?: boolean;
      /** Thông báo mặc định nếu server không trả message */
      errorMessage?: string;
    };
  }
}

const MAX_RETRIES = 2;

/** Không retry lỗi chắc chắn lặp lại (4xx trừ 408/429, canceled); retry lỗi tạm thời. */
export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (failureCount >= MAX_RETRIES) return false;
  const appError = parseApiError(error);
  switch (appError.kind) {
    case "canceled":
    case "unauthorized":
    case "forbidden":
    case "locked":
    case "not_found":
    case "validation":
    case "conflict":
    case "too_large":
      return false;
    case "rate_limited":
      return failureCount < 1;
    default:
      return true; // network, timeout, server, starting, unknown
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Lần tải đầu: component hiển thị lỗi (QueryState). Chỉ toast khi refetch nền
      // thất bại trong lúc vẫn còn dữ liệu cũ trên màn hình.
      if (query.state.data === undefined) return;
      if (query.meta?.silent) return;
      const appError = parseApiError(error);
      if (appError.kind === "canceled") return;
      toast.error(
        appError.kind === "network" || appError.kind === "offline"
          ? "Không thể cập nhật dữ liệu. Đang hiển thị dữ liệu đã lưu."
          : appError.message,
        { id: "background-refetch-error" },
      );
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Mutation tự khai báo onError thì tự chịu trách nhiệm (tránh toast 2 lần).
      if (mutation.options.onError) return;
      if (mutation.meta?.skipGlobalError) return;
      handleError(error, mutation.meta?.errorMessage ?? "Thao tác thất bại");
    },
  }),
  defaultOptions: {
    queries: {
      // Dữ liệu được coi là "tươi" trong 1 phút (không fetch lại)
      staleTime: 1000 * 60 * 1,

      // Không tự động fetch lại khi người dùng click ra ngoài cửa sổ rồi quay lại (đỡ phiền lúc dev)
      refetchOnWindowFocus: false,

      // Retry theo loại lỗi (xem shouldRetryQuery)
      retry: shouldRetryQuery,
      // Có mạng lại thì tự refetch các query đang lỗi/đang dừng
      refetchOnReconnect: true,
    },
  },
});
