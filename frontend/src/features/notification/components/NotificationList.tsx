// src/features/notification/components/NotificationList.tsx
import { useNotifications } from "../hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export const NotificationList = ({ onClose }: { onClose: () => void }) => {
  const { notifications, isLoading } = useNotifications();

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-80 bg-[#282828] border border-white/10 rounded-lg shadow-2xl z-20 overflow-hidden">
        <div className="p-4 border-b border-white/10 font-bold">Thông báo</div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-400">
              Đang tải...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Không có thông báo nào
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                className={`p-4 hover:bg-white/5 cursor-pointer flex gap-3 border-b border-white/5 ${!item.isRead ? "bg-white/5" : ""}`}
              >
                <img
                  src={item.senderId.avatar}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                />
                <div className="flex-1">
                  <p className="text-sm text-white line-clamp-2">
                    {item.message}
                  </p>
                  <span className="text-[11px] text-gray-400">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
export default NotificationList;
