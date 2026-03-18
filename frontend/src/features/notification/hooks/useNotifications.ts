// src/features/notification/hooks/useNotifications.ts
import notifyApi from "@/features/notification/api/notifyApi";
import { notificationKeys } from "@/features/notification/utils/notificationKeys";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [notificationKeys.all],
    queryFn: () => notifyApi.getNotifications(),
  });
  const markAsReadMutation = useMutation({
    mutationFn: notifyApi.markAsRead,
    onSuccess: () => {
      // Cập nhật lại cache cục bộ sau khi đánh dấu đã đọc
      queryClient.invalidateQueries({ queryKey: [notificationKeys.all] });
    },
  });

  return {
    notifications: data?.list || [],
    unreadCount: data?.unreadCount || 0,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
  };
};
