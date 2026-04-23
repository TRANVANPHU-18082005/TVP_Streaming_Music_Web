// --- PHÂN TÁCH DỮ LIỆU CHI TIẾT ---

import { PlayInteraction, RealtimeStats } from "@/features";

export interface NotificationData {
  id?: string;
  message: string;
  type: "like" | "follow" | "system" | "new_track";
  trackId?: string;
  senderName?: string;
  senderAvatar?: string;
  link?: string;
  createdAt?: string | Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SERVER TO CLIENT EVENTS (Server nói - Client nghe)
// ─────────────────────────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  // Connection Trạng thái
  connect: () => void;
  disconnect: () => void;

  // Real-time Analytics (Dashboard Admin)
  admin_analytics_update: (data: RealtimeStats) => void;

  // Bảng xếp hạng thời gian thực
  chart_update: (data: { items: any[]; lastUpdate: string }) => void;

  // Chỉ số người nghe cho bài hát cụ thể
  listeners_count: (count: number) => void;

  // Hệ thống Thông báo (Real-time Push)
  // Khớp với Worker/Service gửi tới từng User Id cụ thể
  notification_received: (data: NotificationData) => void;

  // Phản hồi khi Client thực hiện hành động
  notifications_marked_as_read_success: () => void;

  // Các thông báo lỗi hệ thống (nếu có)
  socket_error: (error: { message: string; code?: string }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLIENT TO SERVER EVENTS (Client nói - Server nghe)
// ─────────────────────────────────────────────────────────────────────────────
export interface ClientToServerEvents {
  // Analytics & Heartbeat
  // trackId gửi lên chuỗi rỗng nếu user không nghe nhạc
  client_heartbeat: (data: {
    userId?: string;
    trackId?: string;
    timestamp?: number;
  }) => void;

  // Tham gia / Rời các khu vực đặc biệt
  join_admin_dashboard: () => void;
  leave_admin_dashboard: () => void;

  join_chart_page: () => void;
  leave_chart_page: () => void;

  // Ghi nhận lượt nghe (Kích hoạt BullMQ & Anti-spam)
  track_play: (data: { trackId: string; userId?: string }) => void;
  interact_play: (data: PlayInteraction) => void;

  // Đăng ký nghe một bài hát (Vào phòng track:id)
  listening_track: (trackId: string) => void;

  // Hủy đăng ký nghe (Khi Pause hoặc Chuyển bài)
  leave_track: (trackId: string) => void;

  // Hành động với Thông báo
  mark_notifications_read: () => void;

  // Gia nhập phòng riêng (Thường tự động dựa trên userId khi connect)
  join_room: (roomName: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SOCKET DATA (Dành cho Backend - socket.data)
// Dùng để lưu trữ thông tin tạm thời trên instance của socket đó
// ─────────────────────────────────────────────────────────────────────────────
export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  ip: string;
}
