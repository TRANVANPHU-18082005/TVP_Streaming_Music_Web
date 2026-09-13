// --- PHÂN TÁCH DỮ LIỆU CHI TIẾT ---

import { RealtimeStats } from "@/features/analytics";
import { PlayInteraction } from "@/features/interaction";

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

  // ── MUSIC ROOM EVENTS (Server → Client) ——————————————————————————————————
  /** Full state khi join phòng — dùng để sync playback */
  "room:state": (data: {
    room: {
      roomCode: string;
      name: string;
      theme: string;
      host: { _id: string; fullName: string; username: string; avatar: string };
      isPublic: boolean;
      memberCount: number;
      queue: any[];
    };
    playbackState: {
      currentTrackId: string | null;
      startedAt: number | null;
      isPaused: boolean;
      pausedAt: number;
    };
    isHost: boolean;
  }) => void;
  /** Playback cập nhật (skip/pause/resume) */
  "room:playback_update": (data: {
    currentTrackId: string | null;
    startedAt: number | null;
    isPaused: boolean;
    pausedAt: number;
  }) => void;
  /** Queue cập nhật (vote/add/remove) */
  "room:queue_update": (data: { queue: any[] }) => void;
  /** Thành viên mới vào */
  "room:member_joined": (data: { userId: string; memberCount: number }) => void;
  /** Thành viên rời */
  "room:member_left": (data: { userId: string; memberCount: number }) => void;
  /** Tin nhắn chat mới */
  "room:new_message": (data: any) => void;
  /** Reaction emoji */
  "room:reaction": (data: { userId: string; emoji: string }) => void;
  /** Host thay đổi */
  "room:host_changed": (data: { newHostId: string }) => void;
  /** Phòng bị đóng */
  "room:closed": (data: { roomCode: string; reason?: string }) => void;
  /** Bị kick */
  "room:kicked": (data: { roomCode: string; reason?: string }) => void;
  /** Lỗi */
  "room:error": (data: { message: string, errorCode: string }) => void;
  /** Vote ACK */
  "room:vote_ack": (data: { trackId: string; voted: boolean }) => void;
  /** Heartbeat — sync memberCount */
  "room:heartbeat": (data: { roomCode: string; memberCount: number }) => void;
  /** Request List Update */
  "room:request_list": (requests: any[]) => void;
  /** Theme thay đổi */
  "room:theme_changed": (data: { roomCode: string; theme: string }) => void;
  /** Mood video thay đổi */
  "room:mood_video_changed": (data: { roomCode: string; currentMoodVideo: any }) => void;
  /** Bị cấm chat */
  "room:user_muted": (data: { targetUserId: string }) => void;
  /** Được mở cấm chat */
  "room:user_unmuted": (data: { targetUserId: string }) => void;
  /** Queue trống */
  "room:queue_empty": (data: { message: string }) => void;
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

  // ── MUSIC ROOM EVENTS (Client → Server) ——————————————————————————————————
  /** Vào phòng (có thể kèm mật khẩu cho private room) */
  "room:join": (data: { roomCode: string; password?: string }) => void;
  /** Rời phòng */
  "room:leave": (data: { roomCode: string }) => void;
  /** Gửi tin nhắn chat */
  "room:message": (data: { roomCode: string; content: string }) => void;
  /** Gửi reaction emoji */
  "room:react": (data: { roomCode: string; emoji: string }) => void;
  /** Host: Phát bài tiếp theo */
  "room:play_next": (data: { roomCode: string }) => void;
  /** Host: Pause/Resume */
  "room:toggle_pause": (data: { roomCode: string; currentPosition: number }) => void;
  /** Vote bài tiếp theo */
  "room:vote": (data: { roomCode: string; trackId: string }) => void;
  /** Yêu cầu bài hát */
  "room:request_track": (data: { roomCode: string; trackId: string }) => void;
  /** Host xử lý yêu cầu bài hát */
  "room:handle_request": (data: { roomCode: string; trackId: string; action: "approve" | "reject" }) => void;
  /** Host đổi không gian phòng */
  "room:change_theme": (data: { roomCode: string; theme: string }) => void;
  /** Thay đổi video nền phòng (Host) */
  "room:set_mood_video": (data: { roomCode: string; videoId: string | null }) => void;
  /** Host cấm chat */
  "room:mute_user": (data: { roomCode: string; targetUserId: string }) => void;
  /** Host mở cấm chat */
  "room:unmute_user": (data: { roomCode: string; targetUserId: string }) => void;
  /** Host xóa tin nhắn */
  "room:delete_message": (data: { roomCode: string; messageId: string }) => void;
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
