import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import type { Store } from "@reduxjs/toolkit"; // Import Type
import { LOGOUT_ACTION } from "@/store/store";
import { handleError } from "@/utils/handleError";

// Định nghĩa Interface
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RetryQueueItem {
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// Biến cục bộ
let isRefreshing = false;
let failedQueue: RetryQueueItem[] = [];
let currentAccessToken: string | null = null;
let store: Store | null = null; // Lưu biến Store ở đây

// ============================================================================
// 1. INJECT STORE (Cách phá vòng lặp dependency chuẩn nhất)
// ============================================================================
export const injectStore = (_store: Store) => {
  store = _store;
};

// Hàm update token từ bên ngoài (được gọi bởi store.subscribe)
export const setGlobalAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Instance chính dùng cho toàn app
const api = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Instance "sạch" chỉ dùng để gọi Refresh Token (Tránh lặp interceptor)
const refreshApi = axios.create({
  baseURL: env.API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================
api.interceptors.request.use(
  (config) => {
    // Luôn ưu tiên token từ biến cục bộ (nhanh nhất)
    if (currentAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ============================================================================
// RESPONSE INTERCEPTOR
// =========================================  ===================================
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // Handle cancelled/aborted requests (e.g. React StrictMode double-mounts)
    // Axios cancellation typically sets `error.code === 'ERR_CANCELED'` or
    // `error.name === 'CanceledError'`. Treat these as expected and attach
    // a flag so callers (React Query / components) can silently ignore them.
    const anyErr = error as any;
    if (
      anyErr?.code === "ERR_CANCELED" ||
      anyErr?.name === "CanceledError" ||
      String(anyErr?.message).toLowerCase().includes("canceled") ||
      String(anyErr?.message).toLowerCase().includes("aborted")
    ) {
      anyErr.isCanceled = true;
      return Promise.reject(anyErr);
    }

    if (!originalRequest) return Promise.reject(error);

    const { status, data } = error.response as any;
    // ----------------------------------------------------------------
    // 🛑 CASE 1: TÀI KHOẢN BỊ KHÓA (BLOCK) - Ưu tiên xử lý trước
    // ----------------------------------------------------------------
    // 🛑 XỬ LÝ KHÓA TÀI KHOẢN
    if (
      status === 403 &&
      (data?.errorCode === "ACCOUNT_LOCKED" || data?.message?.includes("khóa"))
    ) {
      if (window.location.pathname === "/login") return Promise.reject(error);

      // 1. Xóa Redux/Local data
      store?.dispatch({ type: LOGOUT_ACTION });
      setGlobalAccessToken(null);

      // 2. Đá về Login kèm tín hiệu trên URL
      // Dùng window.location để đảm bảo clean sạch memory cũ
      window.location.href = "/login?error=locked";

      return Promise.reject(error);
    }
    // LOGIC 401 & REFRESH TOKEN
    if (status === 401 && !originalRequest._retry) {
      try {
        // If we're currently on a social callback page that includes an access
        // token in the URL (e.g. /auth/facebook?token=...), skip the automatic
        // refresh attempt — the browser may not yet have stored the Set-Cookie
        // issued by the OAuth redirect response, causing refresh to fail.
        const pathname =
          typeof window !== "undefined" ? window.location.pathname : "";
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        const isSocialCallback =
          pathname.startsWith("/auth") &&
          (search.includes("token=") || search.includes("code="));
        if (isSocialCallback) {
          // Let the original 401 bubble up (the social callback page will
          // handle login using the token in the URL). Avoid triggering a
          // refresh request with no cookie present.
          return Promise.reject(error);
        }
      } catch (e) {
        handleError(e, "Error checking social callback URL during 401 handling");
        // ignore
      }
      // 1. Nếu lỗi 401 đến từ chính API refresh hoặc login -> Logout luôn
      if (originalRequest.url?.includes("/auth/")) {
        // Dispatch action Logout (Dùng type string để an toàn dependency)
        store?.dispatch({ type: LOGOUT_ACTION });
        return Promise.reject(error);
      }

      // 2. Nếu đang có tiến trình refresh khác chạy
      if (isRefreshing) {
        return new Promise<any>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // 3. Bắt đầu refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API bằng instance sạch
        const { data } = await refreshApi.post("/auth/refresh-token");
        const newAccessToken =
          data.data?.accessToken || data.accessToken || data.token;

        if (!newAccessToken) {
          throw new Error("Không lấy được token mới");
        }

        setGlobalAccessToken(newAccessToken);
        api.defaults.headers.common["Authorization"] =
          `Bearer ${newAccessToken}`;
        // Cập nhật Redux (Store sẽ tự update ngược lại biến currentAccessToken qua subscribe)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        store?.dispatch({
          type: "auth/refreshSuccess",
          payload: { accessToken: newAccessToken },
        });

        // Xử lý hàng đợi đang chờ
        processQueue(null, newAccessToken);

        // Gọi lại request gốc bị lỗi lúc nãy
        return api(originalRequest);
      } catch (refreshError: any) {
        // Xử lý hàng đợi thất bại
        processQueue(refreshError, null);

        // 👇 LOGIC MỚI: Chỉ Logout khi chắc chắn Refresh Token đã chết
        const status = refreshError.response?.status;

        if (status === 400 || status === 401 || status === 403) {
          // Phiên đăng nhập đã thực sự hết hạn hoặc refresh token không hợp lệ.
          // Chỉ dọn dẹp state (logout). Không tự động redirect từ interceptor
          // để tránh điều hướng bất ngờ khi app đang khởi tạo (ví dụ: trang Home).
          store?.dispatch({ type: LOGOUT_ACTION });
          setGlobalAccessToken(null);

          // NOTE: Frontend routing should observe auth state and redirect user
          // to the login page when appropriate (for protected routes). If you
          // still want an automatic redirect, implement it in a top-level
          // auth listener so navigation is handled by React Router.
        }

        // Nếu là lỗi 500, lỗi mạng (network error)... thì KHÔNG logout.
        // Để người dùng F5 lại trang vẫn còn session.

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
