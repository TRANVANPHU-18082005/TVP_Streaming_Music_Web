import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player/slice/playerSlice";
import { useMemo, type CSSProperties } from "react";

/**
 * Hook tự động tính toán padding bottom để tránh bị Music Player che mất.
 * @param customOffset - (Optional) Cộng thêm pixel nếu muốn hở nhiều hơn (mặc định 0)
 */
export const usePlayerPadding = (customOffset = 0) => {
  const { currentTrackId } = useSelector(selectPlayer);

  // Chiều cao chuẩn của Player (Mobile 80px, Desktop 90px)
  // Bạn có thể check window width nếu muốn chính xác tuyệt đối, nhưng 90px là an toàn cho cả hai.
  const PLAYER_HEIGHT = 90;

  const style = useMemo<CSSProperties>(() => {
    return {
      paddingBottom: currentTrackId
        ? `${PLAYER_HEIGHT + customOffset}px`
        : "0px",
    };
  }, [currentTrackId, customOffset]);

  return {
    // Class tạo hiệu ứng mượt
    className: "transition-[padding-bottom] duration-300 ease-in-out",
    // Style gán cứng giá trị padding (Fix lỗi Tailwind dynamic)
    style,
  };
};
