import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const useSmartBack = (fallbackPath = "/") => {
  const navigate = useNavigate();
  return useCallback(() => {
    // 1. Kiểm tra nếu có state đặc biệt (ví dụ đang mở Search Overlay)
    // logic đóng overlay ở đây...

    // 2. Kiểm tra lịch sử trình duyệt
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  }, [navigate, fallbackPath]);
};
