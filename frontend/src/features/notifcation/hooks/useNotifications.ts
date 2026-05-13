// src/features/notification/hooks/useNotifications.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "../utils/notificationKeys";
import notifyApi from "../api/notifyApi";

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
