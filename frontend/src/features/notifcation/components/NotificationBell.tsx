// src/features/notification/components/NotificationBell.tsx
import { Bell } from "lucide-react";
import { useNotificationListener } from "../hooks/useNotificationListener";
import { useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import NotificationList from "./NotificationList";

export const NotificationBell = () => {
  useNotificationListener(); // Kích hoạt lắng nghe real-time
  const { unreadCount, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAsRead(); // Đánh dấu đã đọc khi mở menu
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="p-2 hover:bg-white/10 rounded-full transition relative"
      >
        <Bell
          size={24}
          className={unreadCount > 0 ? "text-white" : "text-gray-400"}
        />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#121212] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && <NotificationList onClose={() => setIsOpen(false)} />}
    </div>
  );
};
export default NotificationBell;
