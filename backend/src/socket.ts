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

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    const userIp = getClientIp(socket);
    // 🔥 BƯỚC QUAN TRỌNG CHO NOTIFICATION:
    // Khi user connect, check xem họ có gửi userId (thông qua query hoặc auth) không.
    // Nếu dùng Auth middleware cho Socket thì lấy từ socket.data.user.
    // Ở đây mình lấy đơn giản từ query hoặc handshake để bạn dễ test.
    const userId = socket.handshake.query.userId as string;

    if (userId && userId !== "undefined") {
      socket.join(userId);
      console.log(`🔔 User ${userId} joined their private notification room`);
    }

    // 1. Theo dõi vị trí (Analytics ngay khi vào app)
    analyticsService.trackUserLocation(userIp);

    // --- PHẦN 1: ROOMS & LISTENERS ---
    socket.on("join_room", (room: string) => socket.join(room));

    socket.on("listening_track", (trackId: string) => {
      const roomName = `track:${trackId}`;
      socket.join(roomName);
      const count = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      io.to(roomName).emit("listeners_count", count);
    });

    // --- PHẦN 2: REAL-TIME ANALYTICS HEARTBEAT ---
    socket.on(
      "client_heartbeat",
      (data: { userId: string; trackId?: string }) => {
        if (data.userId) {
          analyticsService.pingUserActivity(data.userId, data.trackId);
        }
      },
    );

    // --- PHẦN 3: XỬ LÝ VIEW NHẠC (CHUẨN PRODUCTION) ---
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

    // --- PHẦN 4: ADMIN & CHART ROOMS ---
    socket.on("join_chart_page", () => {
      socket.join("live_chart_room");
      getRealtimeChart().then((data) => socket.emit("chart_update", data));
    });

    socket.on("join_admin_dashboard", () => {
      socket.join("admin_room");
      analyticsService
        .getStats()
        .then((stats) => socket.emit("admin_analytics_update", stats));
    });
    // --- PHẦN 5: NOTIFICATION LOGIC (BỔ SUNG) ---
    // API để đánh dấu đã đọc hoặc các tương tác thông báo khác nếu cần
    socket.on("mark_notifications_read", () => {
      // Logic xử lý nhanh nếu cần
    });
    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });

  // --- SERVER PUSH (Tối ưu hiệu năng) ---

  // Update Dashboard Admin (Mỗi 5s nếu có admin online)
  setInterval(async () => {
    if (io.sockets.adapter.rooms.get("admin_room")?.size) {
      const stats = await analyticsService.getStats();
      io.to("admin_room").emit("admin_analytics_update", stats);
    }
  }, 5000);

  // Update Chart (Mỗi 10s nếu có user xem chart)
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
