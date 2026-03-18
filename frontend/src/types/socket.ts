// src/types/socket.ts

// 1. Sự kiện Server gửi xuống Client (Listen)
export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;

  // Analytics
  admin_analytics_update: (data: RealtimeStats) => void;
  chart_update: (data: any) => void; // Thường là object { items, chart } như hook useRealtimeChart đã dùng

  // Đếm người nghe realtime
  listeners_count: (count: number) => void;

  // 🔥 NOTIFICATION (Cần thêm vào đây)
  // Khớp với: io.to(uid).emit("notification_received", ...) ở Worker
  notification_received: (data: {
    message: string;
    trackId?: string;
    type?: string;
    link?: string;
  }) => void;

  // Đồng bộ trạng thái đã đọc (nếu có dùng socket logic bổ sung)
  notifications_marked_as_read_success: () => void;
}

// 2. Sự kiện Client gửi lên Server (Emit)
export interface ClientToServerEvents {
  // Analytics
  client_heartbeat: (data: { userId: string; trackId: string }) => void;

  // Admin & Chart
  join_admin_dashboard: () => void;
  leave_admin_dashboard: () => void;
  join_chart_page: () => void;
  leave_chart_page: () => void;

  // Báo cáo nghe nhạc
  track_play: (data: { trackId: string; userId?: string }) => void;

  // Tham gia phòng nghe nhạc cụ thể
  listening_track: (trackId: string) => void;

  // 🔥 NOTIFICATION ACTIONS (Cần thêm vào đây)
  // Khớp với socket.on("mark_notifications_read") ở Backend
  mark_notifications_read: () => void;
}

export interface RealtimeStats {
  activeUsers: number;
  nowListening: any[];
  trending: any[];
  geoData?: any[]; // Thêm nếu bạn có làm bản đồ user
}
