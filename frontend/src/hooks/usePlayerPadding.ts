import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player/slice/playerSlice";
import { useMemo, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { CLIENT_PATHS } from "@/config/paths";

/**
 * Hook tự động tính toán padding bottom để tránh bị Music Player che mất.
 * @param customOffset - (Optional) Cộng thêm pixel nếu muốn hở nhiều hơn (mặc định 0)
 *
 */
export const usePlayerPadding = (customOffset = 0) => {
  const { currentTrackId } = useSelector(selectPlayer);
  const location = useLocation();
  const isForMePage = location.pathname === `/${CLIENT_PATHS.FOR_ME}`;

  // Chiều cao chuẩn của Player (Mobile 80px, Desktop 90px)
  const PLAYER_HEIGHT = 90;

  const style = useMemo<CSSProperties>(() => {
    if (isForMePage) return { paddingBottom: "0px" };
    return {
      paddingBottom: currentTrackId
        ? `${PLAYER_HEIGHT + customOffset}px`
        : "0px",
    };
  }, [currentTrackId, customOffset, isForMePage]);

  return {
    // Class tạo hiệu ứng mượt
    className: "transition-[padding-bottom] duration-300 ease-in-out",
    // Style gán cứng giá trị padding (Fix lỗi Tailwind dynamic)
    style,
  };
};
