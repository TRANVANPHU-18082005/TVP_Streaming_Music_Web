import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import analyticsService from "./services/analytics.service";
import { getRealtimeChart } from "./services/chart.service";
import { viewQueue } from "./queue/view.queue"; // Đảm bảo chữ q viết thường
import { cacheRedis } from "./config/redis";

let io: Server;

const getClientIp = (socket: Socket): string => {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    const ipList = typeof forwarded === "string" ? forwarded : forwarded[0];
    return ipList.split(",")[0].trim();
  }
  return socket.handshake.address || "";
};

// ... (Các phần import giữ nguyên)

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    const userIp = getClientIp(socket);
    const userId = socket.handshake.query.userId as string;

    /**
     * [PRIVATE ROOM]
     * Tên: Cá nhân hóa thông báo
     * Chức năng: Đưa user vào một phòng riêng có tên là chính ID của họ.
     * Dùng để: Gửi thông báo (Like, Follow) đích danh cho user này mà người khác không thấy.
     */

    if (userId && userId !== "undefined") {
      socket.join(userId);
      console.log(`🔔 User ${userId} joined their private notification room`);
    }

    // 1. Theo dõi vị trí (Analytics ngay khi vào app)
    analyticsService.trackUserLocation(userIp);

    /**
     * [EVENT: join_room]
     * Chức năng: Cho phép Client gia nhập vào bất kỳ phòng (room) nào theo yêu cầu.
     * Dùng để: Tham gia vào phòng chat, phòng sự kiện chung.
     */
    socket.on("join_room", (room: string) => socket.join(room));

    /**
     * [EVENT: listening_track]
     * Chức năng: Đăng ký nghe một bài hát cụ thể.
     * Dùng để:
     * 1. Gom nhóm những người đang nghe cùng một bài hát.
     * 2. Tính toán số lượng người đang nghe (Real-time listeners count) cho bài đó.
     */
    socket.on("listening_track", (trackId: string) => {
      const roomName = `track:${trackId}`;
      socket.join(roomName);
      // Lấy tổng số kết nối hiện có trong phòng này
      const count = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      // Gửi số lượng người nghe cho tất cả mọi người đang nghe bài này
      io.to(roomName).emit("listeners_count", count);
    });

    /**
     * [EVENT: client_heartbeat]
     * Chức năng: Nhận tín hiệu "duy trì sự sống" từ Client.
     * Dùng để: Cập nhật trạng thái "Active" của user trên Dashboard Admin.
     * Nếu 1 phút không nhận được cái này, Admin sẽ thấy user đó đã Offline.
     */
    socket.on(
      "client_heartbeat",
      (data: { userId: string; trackId?: string }) => {
        if (data.userId) {
          analyticsService.pingUserActivity(data.userId, data.trackId);
        }
      },
    );

    /**
     * [EVENT: track_play] (TRỌNG TÂM)
     * Chức năng: Ghi nhận sự kiện một bài hát bắt đầu được phát.
     * Quy trình:
     * 1. Anti-spam: Dùng Redis chặn nếu 1 user/ip cố tình "cày view" liên tục.
     * 2. Analytics: Cập nhật số liệu nóng (Real-time dashboard).
     * 3. Queue: Đẩy vào BullMQ để xử lý ghi Log vào MongoDB một cách bất đồng bộ (tránh lag server).
     */
    socket.on(
      "track_play",
      async (data: { trackId: string; userId?: string }) => {
        try {
          const { trackId, userId } = data;

          // 🛡️ BƯỚC 1: ANTI-SPAM (Khóa 10 phút)
          // Chặn người dùng emit liên tục để phá chart
          const spamKey = `limit:view:${trackId}:${userId || userIp}`;
          const isSpam = await cacheRedis.get(spamKey);

          if (isSpam) {
            console.log(
              `🚫 Spam detected for track ${trackId} from ${userId || userIp}`,
            );
            return;
          }

          // Đánh dấu đã đếm (10 phút = 600s)
          await cacheRedis.set(spamKey, "1", "EX", 600);

          // 🚀 BƯỚC 2: ANALYTICS (Ghi RAM -> Dashboard nhảy số sau 10s)
          analyticsService.trackPlay(trackId);

          // 📦 BƯỚC 3: BULLMQ (Ghi Log vĩnh viễn vào MongoDB)
          await viewQueue.add(
            "log-listen-history",
            {
              trackId,
              userId,
              ip: userIp,
              timestamp: new Date(),
            },
            { removeOnComplete: true },
          );

          console.log(`✅ Track Play Recorded: ${trackId}`);
        } catch (error) {
          console.error("❌ Socket track_play error:", error);
        }
      },
    );

    /**
     * [EVENT: join_chart_page]
     * Chức năng: Đưa user vào phòng "Xem biểu đồ trực tuyến".
     * Dùng để: Khi dữ liệu bảng xếp hạng thay đổi, server sẽ tự "đẩy" (push) data mới cho user.
     */
    socket.on("join_chart_page", () => {
      socket.join("live_chart_room");
      getRealtimeChart().then((data) => socket.emit("chart_update", data));
    });

    /**
     * [EVENT: join_admin_dashboard]
     * Chức năng: Dành riêng cho quản trị viên.
     * Dùng để: Nhận dữ liệu tổng quan về hệ thống (lượt nghe, số người online) mỗi 5 giây.
     */
    socket.on("join_admin_dashboard", () => {
      socket.join("admin_room");
      analyticsService
        .getStats()
        .then((stats) => socket.emit("admin_analytics_update", stats));
    });
    /**
     * [EVENT: jmark_notifications_read]
     * Chức năng: Dành riêng cho quản trị viên.
     * Dùng để: Nhận dữ liệu tổng quan về hệ thống (lượt nghe, số người online) mỗi 5 giây.
     */
    socket.on("mark_notifications_read", () => {
      // Logic xử lý nhanh nếu cần
    });
    /**
     * [EVENT: disconnect]
     * Chức năng: Xử lý khi user thoát app hoặc mất mạng.
     * Dùng để: Dọn dẹp dữ liệu, giảm số lượng người nghe trong các phòng bài hát.
     */
    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });

  // --- SERVER PUSH LOGIC (Cơ chế chủ động từ Server) ---

  /**
   * [PUSH: Admin Update]
   * Chức năng: Cập nhật Dashboard Admin mỗi 5 giây.
   * Tối ưu: Chỉ chạy Query Database khi có ít nhất 1 Admin đang mở Dashboard.
   */
  setInterval(async () => {
    if (io.sockets.adapter.rooms.get("admin_room")?.size) {
      const stats = await analyticsService.getStats();
      io.to("admin_room").emit("admin_analytics_update", stats);
    }
  }, 5000);

  /**
   * [PUSH: Chart Update]
   * Chức năng: Cập nhật Bảng xếp hạng Real-time mỗi 10 giây.
   * Tối ưu: Chỉ tính toán Chart khi có ít nhất 1 người đang xem trang Chart.
   */
  setInterval(async () => {
    if (io.sockets.adapter.rooms.get("live_chart_room")?.size) {
      const chartData = await getRealtimeChart();
      io.to("live_chart_room").emit("chart_update", chartData);
    }
  }, 10000);

  return io;
};
export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
