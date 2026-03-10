import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import analyticsService from "./services/analytics.service";
import { getRealtimeChart } from "./services/chart.service";
// 👇 Nhớ import service analytics

let io: Server;

// Helper: Lấy IP thật
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
    cors: {
      // 🔥 FIX QUAN TRỌNG: Cho phép tất cả (*) để test kết nối trước
      // Nếu để localhost:5173 mà Vite nhảy sang 5174 là tạch ngay
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    // 👇 LOG NÀY PHẢI HIỆN KHI F5 TRÌNH DUYỆT
    console.log(
      `🔌 Socket Connected: ${socket.id} | IP: ${getClientIp(socket)}`
    );

    // =================================================
    // PHẦN 1: LOGIC JOIN ROOM / LISTENING (Của File 1 cũ)
    // =================================================
    socket.on("join_room", (room: string) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room: ${room}`);
    });

    socket.on("leave_room", (room: string) => {
      socket.leave(room);
    });

    // Realtime Listeners Count (Số người đang nghe cùng 1 bài)
    socket.on("listening_track", (trackId: string) => {
      const roomName = `track:${trackId}`;
      socket.join(roomName);
      const count = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      io.to(roomName).emit("listeners_count", count);
    });

    // =================================================
    // PHẦN 2: LOGIC ANALYTICS (Của File 2 cũ - ĐƯỢC KÍCH HOẠT TẠI ĐÂY)
    // =================================================

    // A. Tracking Vị trí GeoIP ngay khi connect
    analyticsService.trackUserLocation(getClientIp(socket));

    // B. HEARTBEAT (User Online)
    socket.on(
      "client_heartbeat",
      (data: { userId: string; trackId: string }) => {
        // Logic backend cũ của bạn check if (data.userId && data.trackId) là SAI
        // Sửa lại: Chỉ cần userId là tính online rồi
        if (data.userId) {
          analyticsService.pingUserActivity(data.userId, data.trackId);
        }
      }
    );
    socket.on("join_chart_page", () => {
      socket.join("live_chart_room");
      // Gửi data ngay lập tức (Initial Load qua Socket)
      getRealtimeChart().then((data) => socket.emit("chart_update", data));
    });

    socket.on("leave_chart_page", () => {
      socket.leave("live_chart_room");
    });
    // C. TRACK PLAY (Đếm View)
    socket.on("track_play", (data: { trackId: string; userId?: string }) => {
      // Đẩy vào Buffer của Analytics Service
      analyticsService.trackPlay(
        data.trackId,
        data.userId,
        getClientIp(socket)
      );
    });

    // D. ADMIN DASHBOARD
    socket.on("join_admin_dashboard", () => {
      console.log("👨‍💻 Admin joined dashboard");
      socket.join("admin_room");
      // Gửi data ngay lập tức
      analyticsService.getStats().then((stats) => {
        socket.emit("admin_analytics_update", stats);
      });
    });

    // --- DISCONNECT ---
    // Server-side
    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  // =================================================
  // PHẦN 3: SERVER PUSH (Gửi data cho Admin mỗi 5s)
  // =================================================
  setInterval(async () => {
    try {
      const room = io.sockets.adapter.rooms.get("admin_room");
      // Chỉ gửi khi có người xem admin
      if (room && room.size > 0) {
        const stats = await analyticsService.getStats();
        io.to("admin_room").emit("admin_analytics_update", stats);
      }
    } catch (error) {
      console.error("Socket Push Error", error);
    }
  }, 5000);
  setInterval(async () => {
    try {
      const room = io.sockets.adapter.rooms.get("live_chart_room");
      // Chỉ tính toán khi có người xem
      if (room && room.size > 0) {
        const chartData = await getRealtimeChart();
        io.to("live_chart_room").emit("chart_update", chartData);
      }
    } catch (e) {
      console.error("Socket Push Error", e);
    }
  }, 10000);
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
