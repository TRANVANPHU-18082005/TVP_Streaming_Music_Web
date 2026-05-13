// socket.ts

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import analyticsService from "./services/analytics.service";
import { getRealtimeChart } from "./services/chart.service";
import { viewQueue } from "./queue/view.queue";
import { cacheRedis } from "./config/redis";
import config from "./config/env";
import { PlayInteraction } from "./types/interaction.type";

let io: Server;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getClientIp = (socket: Socket): string => {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    const ipList = typeof forwarded === "string" ? forwarded : forwarded[0];
    return ipList.split(",")[0].trim();
  }
  return socket.handshake.address ?? "";
};

/** Tổng số socket đang kết nối (cả guest lẫn authenticated) */
export const getActiveNowCount = (): number => io?.sockets.sockets.size ?? 0;

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins || [],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60_000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    const userIp = getClientIp(socket);

    // userId từ query: MongoId (authenticated) hoặc absent (guest)
    // FIX: dùng "guest_<socketId>" cho khách vãng lai để phù hợp với analyticsService
    const rawUserId = socket.handshake.query.userId as string | undefined;
    const userId =
      rawUserId && rawUserId !== "undefined" && rawUserId.trim()
        ? rawUserId.trim()
        : `guest_${socket.id}`;

    const isGuest = userId.startsWith("guest_");

    // ── Private notification room (chỉ cho authenticated user) ──────────────
    if (!isGuest) {
      socket.join(userId);
    }

    // ── Geo tracking ─────────────────────────────────────────────────────────
    analyticsService.trackUserLocation(userIp);

    // ── Heartbeat ngay khi connect (khởi tạo trạng thái online) ─────────────
    analyticsService.pingUserActivity(userId);

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    /** Tham gia phòng chat / sự kiện chung */
    socket.on("join_room", (room: string) => {
      if (typeof room === "string" && room.length < 100) {
        socket.join(room);
      }
    });

    /**
     * Đăng ký nghe một track cụ thể.
     * Tự động rời phòng track cũ và thông báo cập nhật listeners_count.
     */
    socket.on("listening_track", (trackId: string) => {
      if (!trackId || typeof trackId !== "string") return;

      const newRoom = `track:${trackId}`;

      // Rời tất cả phòng track cũ
      Array.from(socket.rooms).forEach((room) => {
        if (room.startsWith("track:") && room !== newRoom) {
          socket.leave(room);
          const prevCount = io.sockets.adapter.rooms.get(room)?.size ?? 0;
          io.to(room).emit("listeners_count", prevCount);
        }
      });

      socket.join(newRoom);
      const count = io.sockets.adapter.rooms.get(newRoom)?.size ?? 0;
      io.to(newRoom).emit("listeners_count", count);
    });

    /**
     * Heartbeat: Client gửi mỗi 30s để duy trì trạng thái online.
     * FIX: userId từ payload có thể là guest_ → analyticsService xử lý được.
     */
    socket.on(
      "client_heartbeat",
      (data: { userId?: string; trackId?: string }) => {
        // Ưu tiên userId từ payload, fallback về userId của socket này
        const hbUserId =
          data.userId && data.userId !== "undefined" ? data.userId : userId;
        analyticsService.pingUserActivity(hbUserId, data.trackId);
      },
    );
    socket.on("interact_play", async (data: PlayInteraction) => {
      try {
        const { targetId, targetType, userId } = data;

        // 1. Validate cơ bản
        if (
          !targetId ||
          !["track", "album", "playlist", "artist", "genre"].includes(
            targetType,
          )
        ) {
          return;
        }

        // 2. Chống spam (Dùng chung key hoặc tách theo loại)
        const identity = userId || userIp || socket.id;
        const spamKey = `limit:play:${targetType}:${targetId}:${identity}`;

        if (await cacheRedis.get(spamKey)) return;
        await cacheRedis.set(spamKey, "1", "EX", 600);

        // 3. Tăng View Buffer trong Redis
        await cacheRedis.incr(`views:${targetType}:${targetId}`);

        // 4. CHỈ Log lịch sử nếu là Track
        if (targetType === "track" && userId) {
          analyticsService.trackPlay(targetId);
          await viewQueue.add(
            "log-listen-history",
            {
              trackId: targetId,
              userId,
              ip: userIp,
              timestamp: new Date(),
            },
            { removeOnComplete: true, removeOnFail: { count: 100 } },
          );
        }

        // 5. Nếu cần Analytics khác (như realtime dashboard), bạn có thể gọi thêm service tại đây
      } catch (error) {
        console.error("[Socket] interact_play error:", error);
      }
    });
    /**
     * Ghi nhận một lượt play.
     * Anti-spam → Analytics RAM buffer → BullMQ async log.
     */
    // socket.on(
    //   "track_play",
    //   async (data: { trackId: string; userId?: string }) => {
    //     try {
    //       const { trackId } = data;
    //       console.log(data);
    //       if (!trackId || typeof trackId !== "string") return;

    //       // Xác định identity để anti-spam (prefer userId, fallback IP)
    //       const identity = data.userId || userIp || socket.id;
    //       const spamKey = `limit:view:${trackId}:${identity}`;

    //       const isSpam = await cacheRedis.get(spamKey);
    //       if (isSpam) return;

    //       await cacheRedis.set(spamKey, "1", "EX", 600);

    //       analyticsService.trackPlay(trackId);
    //       if (data?.userId) {
    //         await viewQueue.add(
    //           "log-listen-history",
    //           {
    //             trackId,
    //             userId: data.userId,
    //             ip: userIp,
    //             timestamp: new Date(),
    //           },
    //           { removeOnComplete: true, removeOnFail: { count: 100 } },
    //         );
    //       }
    //     } catch (error) {
    //       console.error("[Socket] track_play error:", error);
    //     }
    //   },
    // );

    /** Join chart page — nhận push update mỗi 10s */
    socket.on("join_chart_page", () => {
      socket.join("live_chart_room");
      getRealtimeChart()
        .then((data) => socket.emit("chart_update", data))
        .catch(console.error);
    });

    /** Join admin dashboard — nhận push update mỗi 5s */
    socket.on("join_admin_dashboard", () => {
      socket.join("admin_room");
      analyticsService
        .getStats()
        .then((stats) =>
          socket.emit("admin_analytics_update", buildLiveStats(stats)),
        )
        .catch(console.error);
    });

    /** Rời admin dashboard (khi Admin đóng tab analytics) */
    socket.on("leave_admin_dashboard", () => {
      socket.leave("admin_room");
    });

    socket.on("mark_notifications_read", () => {
      // placeholder — logic đọc notification
    });
    /**
     * Cleanup khi disconnect.
     * FIX: Dọn trạng thái online ngay lập tức thay vì chờ timeout 1 phút.
     */
    socket.on("disconnecting", () => {
      // Lấy danh sách các phòng bài hát mà user này đang ở
      const rooms = Array.from(socket.rooms);

      rooms.forEach((room) => {
        if (room.startsWith("track:")) {
          // Vì socket này chuẩn bị thoát, size thực tế sẽ là size hiện tại - 1
          const currentSize = io.sockets.adapter.rooms.get(room)?.size ?? 0;
          const nextSize = Math.max(0, currentSize - 1);

          // Gửi cho những người còn lại trong phòng bài hát đó
          io.to(room).emit("listeners_count", nextSize);
        }
      });
    });

    /**
     * Dọn dẹp trạng thái Online vĩnh viễn
     */
    socket.on("disconnect", async () => {
      try {
        // Xóa khỏi Redis ngay lập tức để Dashboard Admin cập nhật chính xác
        await cacheRedis.zrem("online_users", userId);
      } catch (err) {
        console.error("[Socket] Redis zrem error:", err);
      }
      console.log(`❌ Socket disconnected: ${socket.id} (User: ${userId})`);
    });
  });

  // ── SERVER PUSH INTERVALS ────────────────────────────────────────────────

  /**
   * Admin dashboard push mỗi 5 giây.
   * Chỉ query khi có ít nhất 1 Admin đang online.
   */
  const adminInterval = setInterval(async () => {
    const adminRoom = io.sockets.adapter.rooms.get("admin_room");
    if (!adminRoom?.size) return;

    try {
      const stats = await analyticsService.getStats();
      io.to("admin_room").emit("admin_analytics_update", buildLiveStats(stats));
    } catch (error) {
      console.error("[Socket] Admin push error:", error);
    }
  }, 5_000);

  // unref() để interval không giữ process sống khi tắt server
  adminInterval.unref();

  /**
   * Chart push mỗi 10 giây.
   */
  const chartInterval = setInterval(async () => {
    if (!io.sockets.adapter.rooms.get("live_chart_room")?.size) return;

    try {
      const chartData = await getRealtimeChart();
      io.to("live_chart_room").emit("chart_update", chartData);
    } catch (error) {
      console.error("[Socket] Chart push error:", error);
    }
  }, 10_000);

  chartInterval.unref();

  return io;
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: build liveStats payload cho admin
// Gộp analytics service data + socket-level counters
// ─────────────────────────────────────────────────────────────────────────────

function buildLiveStats(
  stats: Awaited<ReturnType<typeof analyticsService.getStats>>,
) {
  // Tổng số socket kết nối (guest + auth)
  const activeNow = io.sockets.sockets.size;

  // Số người đang nghe nhạc (socket trong bất kỳ track: room nào)
  const listeningNow = Array.from(io.sockets.adapter.rooms.keys())
    .filter((key) => key.startsWith("track:"))
    .reduce(
      (acc, key) => acc + (io.sockets.adapter.rooms.get(key)?.size ?? 0),
      0,
    );

  return {
    ...stats, // activeUsers, activeGuests, nowListening, trending, geoData
    activeNow, // tổng socket kết nối
    listeningNow, // đang trong track room
  };
}
