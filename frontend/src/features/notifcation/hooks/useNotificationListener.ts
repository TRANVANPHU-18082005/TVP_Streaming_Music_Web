// src/features/notification/hooks/useNotificationListener.ts
import { useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationKeys } from "../utils/notificationKeys";

export const useNotificationListener = () => {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // 1. Quản lý Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/notification.mp3");
      // Tối ưu: Tải trước âm thanh để khi có noti là kêu ngay, không bị delay
      audioRef.current.load();
    }

    // Cleanup khi component unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Chỉ lắng nghe khi socket thực sự sẵn sàng
    if (!socket || !isConnected) return;

    const handleNotification = (data: {
      message: string;
      trackId?: string;
      link?: string;
      type?: string;
    }) => {
      // 2. Hiển thị Toast (Dùng window.location để an toàn cho mọi loại Router)
      toast(data.message, {
        icon: "🔔",
        position: "top-right",
        description: data.type === "NEW_TRACK" ? "Bấm để nghe ngay" : undefined,
        action: data.link
          ? {
              label: "Xem",
              onClick: () => {
                if (data.link) window.location.href = data.link;
              },
            }
          : undefined,
        style: {
          borderRadius: "12px",
          background: "#1DB954",
          color: "#fff",
          border: "none",
        },
      });

      // 3. Chơi âm thanh thông minh
      if (document.visibilityState === "visible" && audioRef.current) {
        // Reset về 0 để nếu có nhiều noti cùng lúc thì tiếng chuông vẫn kêu lại từ đầu
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Trình duyệt thường chặn auto-play nếu user chưa tương tác gì với trang
          console.warn("Audio playback was prevented by browser.");
        });
      }

      // 4. Đồng bộ dữ liệu UI (Badge chuông và List)
      queryClient.invalidateQueries({ queryKey: [notificationKeys.all] });
      queryClient.invalidateQueries({
        queryKey: [notificationKeys.lists],
      });
    };

    // Đăng ký sự kiện
    socket.on("notification_received", handleNotification);

    // Hủy đăng ký khi effect chạy lại hoặc unmount để tránh trùng lặp listener
    return () => {
      socket.off("notification_received", handleNotification);
    };
  }, [socket, isConnected, queryClient]); // Đã xóa 'router' khỏi đây để hết lỗi
};
