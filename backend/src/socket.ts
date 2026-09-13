// socket.ts

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import analyticsService from "./services/analytics.service";
import { getRealtimeChart } from "./services/chart.service";
import { viewQueue } from "./queue/view.queue";
import { cacheRedis } from "./config/redis";
import config from "./config/env";
import { PlayInteraction } from "./types/interaction.type";
import musicRoomService from "./services/musicRoom.service";
import MusicRoom from "./models/MusicRoom";
import RoomMessage from "./models/RoomMessage";
import User from "./models/User";
import { RoomErrorCode } from "./config/constants";

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
    console.log("isGuest", isGuest, userId)
    // ── Private notification room (chỉ cho authenticated user) ──────────────
    if (!isGuest) {
      socket.join(userId);
    }

    // Biến lưu trữ ID hiện tại của socket này (có thể cập nhật qua heartbeat nếu frontend gửi ID ẩn danh khác)
    let currentUserId = userId;

    // ── Geo tracking ─────────────────────────────────────────────────────────
    analyticsService.trackUserLocation(currentUserId, userIp);

    // ── Heartbeat ngay khi connect (khởi tạo trạng thái online) ─────────────
    analyticsService.pingUserActivity(socket.id, currentUserId);

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
    socket.on("client_heartbeat", ({ userId, trackId }) => {
      const userIp = getClientIp(socket);
      // FIX C: Ghi đè currentUserId bằng ID từ Frontend (quan trọng cho Guest)
      let currentUserId = userId;
      if (!currentUserId && socket.data.user) {
        currentUserId = socket.data.user.id;
      }
      if (!currentUserId) {
        currentUserId = `guest_${socket.id}`;
      }

      analyticsService.pingUserActivity(socket.id, currentUserId, trackId);
    });

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
        if (targetType === "track") {
          analyticsService.trackPlay(targetId);
          await viewQueue.add(
            "log-listen-history",
            {
              trackId: targetId,
              userId: userId || null, // Có thể null cho guest
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

    // ═════════════════════════════════════════════════════════════════════════
    // MUSIC ROOM EVENTS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Vào phòng music room.
     * Emit "room:state" cho client vừa join để sync playback.
     * Broadcast "room:member_joined" cho những người còn lại.
     */
    socket.on("room:join", async ({ roomCode, password }: { roomCode: string; password?: string }) => {
      if (!roomCode || typeof roomCode !== "string") return;
      if (isGuest) {
        socket.emit("room:error", { message: "Vui lòng đăng nhập để vào phòng", errorCode: RoomErrorCode.UNAUTHORIZED });
        return;
      }

      try {
        const roomSocketKey = `music_room:${roomCode}`;

        // Rời phòng music room cũ nếu đang trong (của socket này)
        Array.from(socket.rooms).forEach((room) => {
          if (room.startsWith("music_room:") && room !== roomSocketKey) {
            const oldCode = room.replace("music_room:", "");
            socket.leave(room);
            
            (async () => {
              try {
                const count = await cacheRedis.hincrby(`room:sessions:${oldCode}`, currentUserId, -1);
                if (count <= 0) {
                  await cacheRedis.hdel(`room:sessions:${oldCode}`, currentUserId);
                  const newCount = await cacheRedis.hlen(`room:sessions:${oldCode}`);
                  await MusicRoom.updateOne({ roomCode: oldCode }, { memberCount: newCount });
                  io.to(room).emit("room:member_left", {
                    userId: currentUserId,
                    memberCount: newCount,
                  });
                }
              } catch (e) {
                console.error("[Socket] join -> leave old room error:", e);
              }
            })();
          }
        });

        // Kiểm tra phòng tồn tại & password
        const room = await MusicRoom.findOne({ roomCode, isActive: true })
          .select("+password")
          .populate({
            path: "currentTrack",
            select: "title coverImage duration artist hlsUrl trackUrl moodVideo",
            populate: [
              { path: "artist", select: "name" },
              { path: "moodVideo" }
            ],
          })
          .populate({
            path: "queue.track",
            select: "title coverImage duration artist",
          })
          .populate("currentMoodVideo");

        if (!room) {
          socket.emit("room:error", { message: "Phòng không tồn tại hoặc đã đóng", errorCode: RoomErrorCode.NOT_FOUND });
          return;
        }

        if (!room.isPublic && password !== room.password) {
          socket.emit("room:error", { message: "Mật khẩu phòng không đúng", errorCode: RoomErrorCode.WRONG_PASSWORD });
          return;
        }

        // Giới hạn số người
        const currentCount = io.sockets.adapter.rooms.get(roomSocketKey)?.size ?? 0;
        if (currentCount >= room.maxMembers) {
          socket.emit("room:error", { message: "Phòng đã đầy", errorCode: RoomErrorCode.ROOM_FULL });
          return;
        }

        socket.join(roomSocketKey);
        const sessionCount = await cacheRedis.hincrby(`room:sessions:${roomCode}`, currentUserId, 1);

        // Cập nhật memberCount
        const newCount = await cacheRedis.hlen(`room:sessions:${roomCode}`);
        await MusicRoom.updateOne({ roomCode }, { memberCount: newCount, lastActivityAt: new Date() });

        // Lấy playback state (ưu tiên Redis)
        const playbackState = await musicRoomService.getPlaybackStateFromRedis(roomCode) ?? {
          currentTrackId: room.currentTrack?._id?.toString() ?? room.currentTrack?.toString() ?? null,
          startedAt: room.startedAt?.getTime() ?? null,
          isPaused: room.isPaused,
          pausedAt: room.pausedAt ?? 0,
        };

        // Gửi full state cho user vừa join để sync
        socket.emit("room:state", {
          room: {
            roomCode: room.roomCode,
            name: room.name,
            theme: room.theme,
            host: room.host,
            isPublic: room.isPublic,
            memberCount: newCount,
            queue: room.queue,
            currentTrack: room.currentTrack ?? null,
            currentMoodVideo: room.currentMoodVideo ?? null,
          },
          playbackState,
          isHost: room.host.toString() === currentUserId,
        });

        if (room.host.toString() === currentUserId) {
          const requests = await musicRoomService.getTrackRequests(roomCode);
          socket.emit("room:request_list", requests);
        }

        // Broadcast cho phòng (nếu là thiết bị đầu tiên)
        if (sessionCount === 1) {
          socket.to(roomSocketKey).emit("room:member_joined", {
            userId: currentUserId,
            memberCount: newCount,
          });

          // System message
          const sysMsg = await RoomMessage.create({
            room: room._id,
            senderName: "System",
            content: `Một thành viên mới đã vào phòng`,
            type: "system",
          });
          io.to(roomSocketKey).emit("room:new_message", sysMsg);
        }
      } catch (err) {
        console.error("[Socket] room:join error:", err);
        socket.emit("room:error", { message: "Lỗi khi vào phòng", errorCode: RoomErrorCode.UNKNOWN });
      }
    });

    /**
     * Rời phòng music room.
     * Nếu là Host → tự động chuyển Host cho người tiếp theo.
     */
    socket.on("room:leave", async ({ roomCode }: { roomCode: string }) => {
      if (!roomCode) return;
      const roomSocketKey = `music_room:${roomCode}`;

      try {
        socket.leave(roomSocketKey);

        const count = await cacheRedis.hincrby(`room:sessions:${roomCode}`, currentUserId, -1);
        if (count > 0) {
           // User vẫn còn kết nối khác trong phòng
           return;
        }

        // Hết kết nối -> User thực sự rời phòng
        await cacheRedis.hdel(`room:sessions:${roomCode}`, currentUserId);
        const newCount = await cacheRedis.hlen(`room:sessions:${roomCode}`);
        await MusicRoom.updateOne({ roomCode }, { memberCount: newCount });

        const leaver = isGuest ? null : await User.findById(currentUserId).select("fullName").lean();
        const leaverName = leaver?.fullName || "Khách ẩn danh";

        io.to(roomSocketKey).emit("room:member_left", {
          userId: currentUserId,
          memberCount: newCount,
        });

        // Gửi tin nhắn rời phòng
        const roomForMsg = await MusicRoom.findOne({ roomCode }).lean();
        if (roomForMsg) {
          const leaveMsg = await RoomMessage.create({
            room: roomForMsg._id,
            senderName: "System",
            content: `${leaverName} đã rời phòng`,
            type: "system",
          });
          io.to(roomSocketKey).emit("room:new_message", leaveMsg);
        }

        // Nếu Host rời → auto-transfer
        const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
        if (room && room.host.toString() === currentUserId) {
          // Tìm member còn lại trong phòng
          const remaining = Array.from(io.sockets.adapter.rooms.get(roomSocketKey) ?? []);
          let nextUserId: string | undefined;

          for (const socketId of remaining) {
             const sock = io.sockets.sockets.get(socketId);
             const uid = sock?.handshake.query.userId as string | undefined;
             if (uid && uid !== "undefined" && uid !== currentUserId) {
                 nextUserId = uid;
                 break;
             }
          }

          if (nextUserId) {
            await musicRoomService.transferHost(roomCode, nextUserId);
            io.to(roomSocketKey).emit("room:host_changed", { newHostId: nextUserId });
          } else {
            // Không có ai → đóng phòng
            await MusicRoom.updateOne({ roomCode }, { isActive: false });
            io.to(roomSocketKey).emit("room:closed", { reason: "Host đã rời, phòng không có người" });
            await cacheRedis.del(`room:sessions:${roomCode}`);
          }
        }
      } catch (err) {
        console.error("[Socket] room:leave error:", err);
      }
    });

    /**
     * Gửi tin nhắn chat trong phòng.
     * Rate-limit: 5 msg / 5s xử lý trong service.
     */
    socket.on("room:message", async ({ roomCode, content }: { roomCode: string; content: string }) => {
      if (!roomCode || !content || isGuest) return;

      try {
        // Chỉ cho phép nếu socket đang trong phòng
        if (!socket.rooms.has(`music_room:${roomCode}`)) return;

        // Tìm user info từ DB (đã được authenticate qua protect middleware)
        const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
        if (!room) return;

        if (room.mutedUsers && room.mutedUsers.map(String).includes(currentUserId)) {
          socket.emit("room:error", { message: "Bạn đã bị cấm chat trong phòng này" });
          return;
        }

        // Tạo message trực tiếp (tránh lookup user lại)
        const rateKey = `room:ratelimit:msg:${currentUserId}`;
        const count = await cacheRedis.incr(rateKey);
        if (count === 1) await cacheRedis.expire(rateKey, 5);
        if (count > 5) {
          socket.emit("room:error", { message: "Gửi tin quá nhanh, vui lòng chậm lại" });
          return;
        }

        let senderName = socket.data.fullName ?? "Ẩn danh";
        let senderAvatar = socket.data.avatar ?? "";

        if (!isGuest && currentUserId && !socket.data.fullName) {
          const user = await User.findById(currentUserId).select("fullName avatar").lean();
          if (user) {
            senderName = user.fullName;
            senderAvatar = user.avatar ?? "";
            socket.data.fullName = user.fullName;
            socket.data.avatar = user.avatar;
          }
        }

        const msg = await RoomMessage.create({
          room: room._id,
          sender: isGuest ? undefined : currentUserId,
          senderName,
          senderAvatar,
          content: String(content).slice(0, 300),
          type: "text",
        });

        io.to(`music_room:${roomCode}`).emit("room:new_message", msg);
      } catch (err) {
        console.error("[Socket] room:message error:", err);
      }
    });

    /**
     * Gửi reaction emoji — broadcast animation cho cả phòng.
     */
    socket.on("room:react", ({ roomCode, emoji }: { roomCode: string; emoji: string }) => {
      if (!roomCode || !emoji || isGuest) return;
      if (!socket.rooms.has(`music_room:${roomCode}`)) return;

      // Whitelist emoji để tránh abuse
      const allowed = ["❤️", "🔥", "🎵", "🙌", "😍", "💯", "⚡", "🎉"];
      if (!allowed.includes(emoji)) return;

      io.to(`music_room:${roomCode}`).emit("room:reaction", {
        userId: currentUserId,
        emoji,
      });
    });

    /**
     * Host: Phát bài tiếp theo trong queue.
     */
    socket.on("room:play_next", async ({ roomCode }: { roomCode: string }) => {
      if (!roomCode || isGuest) return;

      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
        if (!room || room.host.toString() !== currentUserId) {
          socket.emit("room:error", { message: "Chỉ Host mới có thể điều khiển phát nhạc" });
          return;
        }

        if (room.queue.length === 0) {
          io.to(`music_room:${roomCode}`).emit("room:queue_empty", {
            message: "Hết nhạc rồi! Host hãy thêm bài mới hoặc Listener có thể yêu cầu bài nhé.",
          });
          return;
        }

        // Lấy user object tối giản
        const fakeUser = { _id: currentUserId, role: "user" } as any;
        const playbackState = await musicRoomService.playNext(roomCode, fakeUser);

        io.to(`music_room:${roomCode}`).emit("room:playback_update", playbackState);
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi chuyển bài" });
      }
    });

    /**
     * Host: Pause/Resume phát nhạc.
     */
    socket.on("room:toggle_pause", async ({ roomCode, currentPosition }: { roomCode: string; currentPosition: number }) => {
      if (!roomCode || isGuest) return;

      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
        if (!room || room.host.toString() !== currentUserId) {
          socket.emit("room:error", { message: "Chỉ Host mới có thể điều khiển phát nhạc" });
          return;
        }

        const fakeUser = { _id: currentUserId, role: "user" } as any;
        const playbackState = await musicRoomService.togglePause(roomCode, fakeUser, currentPosition ?? 0);

        io.to(`music_room:${roomCode}`).emit("room:playback_update", playbackState);
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi pause/resume" });
      }
    });

    /**
     * Vote bài tiếp theo — broadcast queue update.
     */
    socket.on("room:vote", async ({ roomCode, trackId }: { roomCode: string; trackId: string }) => {
      if (!roomCode || !trackId || isGuest) return;
      if (!socket.rooms.has(`music_room:${roomCode}`)) return;

      try {
        const fakeUser = { _id: currentUserId, role: "user" } as any;
        const result = await musicRoomService.voteTrack(roomCode, trackId, fakeUser);

        socket.emit("room:vote_ack", { trackId, voted: result.voted });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi vote" });
      }
    });

    /**
     * Listener yêu cầu thêm bài hát vào phòng.
     */
    socket.on("room:request_track", async ({ roomCode, trackId }: { roomCode: string; trackId: string }) => {
      if (!roomCode || !trackId || isGuest) return;
      if (!socket.rooms.has(`music_room:${roomCode}`)) return;

      try {
        const fakeUser = { _id: currentUserId, role: "user" } as any;
        await musicRoomService.requestTrack(roomCode, trackId, fakeUser);
        
        // Cập nhật danh sách request cho Host
        const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
        if (room && room.host) {
          const requests = await musicRoomService.getTrackRequests(roomCode);
          // Gửi cho Host (vì Host có thể có nhiều session/tab)
          const hostSockets = await io.in(`music_room:${roomCode}`).fetchSockets();
          for (const s of hostSockets) {
            const uid = s.handshake.query.userId as string;
            if (uid === room.host.toString()) {
              s.emit("room:request_list", requests);
            }
          }
        }
        
        socket.emit("room:request_ack", { trackId, success: true });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi yêu cầu bài hát" });
      }
    });

    /**
     * Host duyệt/từ chối yêu cầu bài hát.
     */
    socket.on("room:handle_request", async ({ roomCode, trackId, action }: { roomCode: string; trackId: string; action: "approve" | "reject" }) => {
      if (!roomCode || !trackId || isGuest) return;
      
      try {
        const fakeUser = { _id: currentUserId, role: "user" } as any;
        await musicRoomService.handleRequest(roomCode, trackId, action, fakeUser);
        
        // Gửi lại danh sách cập nhật cho Host
        const requests = await musicRoomService.getTrackRequests(roomCode);
        socket.emit("room:request_list", requests);
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi xử lý yêu cầu" });
      }
    });

    /**
     * Host thay đổi theme phòng
     */
    socket.on("room:change_theme", async ({ roomCode, theme }: { roomCode: string; theme: string }) => {
      if (!roomCode || !theme || isGuest) return;
      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true });
        if (!room || room.host.toString() !== currentUserId) {
          throw new Error("Không có quyền đổi không gian phòng");
        }
        
        room.theme = theme as any;
        await room.save();
        
        // Broadcast sự kiện thay đổi theme cho toàn bộ client trong phòng
        io.to(`music_room:${roomCode}`).emit("room:theme_changed", { roomCode, theme });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi đổi không gian phòng" });
      }
    });

    /**
     * Host thay đổi mood video
     */
    socket.on("room:set_mood_video", async ({ roomCode, videoId }: { roomCode: string; videoId: string | null }) => {
      if (!roomCode || isGuest) return;
      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true });
        if (!room || room.host.toString() !== currentUserId) {
          throw new Error("Không có quyền đổi video nền");
        }
        
        room.currentMoodVideo = videoId as any;
        await room.save();
        await room.populate("currentMoodVideo");
        
        io.to(`music_room:${roomCode}`).emit("room:mood_video_changed", { 
          roomCode, 
          currentMoodVideo: room.currentMoodVideo ?? null 
        });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi đổi video nền" });
      }
    });

    /**
     * Host xóa tin nhắn
     */
    socket.on("room:delete_message", async ({ roomCode, messageId }: { roomCode: string; messageId: string }) => {
      if (!roomCode || !messageId || isGuest) return;
      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true });
        if (!room || room.host.toString() !== currentUserId) {
          throw new Error("Không có quyền thao tác");
        }
        await RoomMessage.findByIdAndDelete(messageId);
        io.to(`music_room:${roomCode}`).emit("room:message_deleted", { messageId });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi xóa tin nhắn" });
      }
    });

    /**
     * Host cấm chat (Mute user)
     */
    socket.on("room:mute_user", async ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      if (!roomCode || !targetUserId || isGuest) return;
      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true });
        if (!room || room.host.toString() !== currentUserId) {
          throw new Error("Không có quyền thao tác");
        }
        if (!room.mutedUsers.includes(targetUserId as any)) {
          room.mutedUsers.push(targetUserId as any);
          await room.save();
        }
        io.to(`music_room:${roomCode}`).emit("room:user_muted", { targetUserId });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi cấm chat" });
      }
    });

    /**
     * Host mở cấm chat (Unmute user)
     */
    socket.on("room:unmute_user", async ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      if (!roomCode || !targetUserId || isGuest) return;
      try {
        const room = await MusicRoom.findOne({ roomCode, isActive: true });
        if (!room || room.host.toString() !== currentUserId) {
          throw new Error("Không có quyền thao tác");
        }
        if (room.mutedUsers.includes(targetUserId as any)) {
          room.mutedUsers = room.mutedUsers.filter((id) => id.toString() !== targetUserId) as any;
          await room.save();
        }
        io.to(`music_room:${roomCode}`).emit("room:user_unmuted", { targetUserId });
      } catch (err: any) {
        socket.emit("room:error", { message: err.message ?? "Lỗi khi mở cấm chat" });
      }
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

        // Xử lý music room
        if (room.startsWith("music_room:")) {
          const roomCode = room.replace("music_room:", "");

          (async () => {
             try {
                const count = await cacheRedis.hincrby(`room:sessions:${roomCode}`, currentUserId, -1);
                if (count > 0) return; // Vẫn còn kết nối khác

                await cacheRedis.hdel(`room:sessions:${roomCode}`, currentUserId);
                const nextSize = await cacheRedis.hlen(`room:sessions:${roomCode}`);
                await MusicRoom.updateOne({ roomCode }, { memberCount: nextSize });

                io.to(room).emit("room:member_left", {
                  userId: currentUserId,
                  memberCount: nextSize,
                });

                // Gửi thông báo hệ thống nếu user này là Host và cần transfer
                const roomInfo = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
                if (roomInfo && roomInfo.host.toString() === currentUserId) {
                   const remaining = Array.from(io.sockets.adapter.rooms.get(room) ?? []);
                   let nextUserId: string | undefined;
                   for (const socketId of remaining) {
                      if (socketId === socket.id) continue;
                      const sock = io.sockets.sockets.get(socketId);
                      const uid = sock?.handshake.query.userId as string | undefined;
                      if (uid && uid !== "undefined" && uid !== currentUserId) {
                          nextUserId = uid;
                          break;
                      }
                   }
                   if (nextUserId) {
                     await musicRoomService.transferHost(roomCode, nextUserId);
                     io.to(room).emit("room:host_changed", { newHostId: nextUserId });
                   } else {
                     await MusicRoom.updateOne({ roomCode }, { isActive: false });
                     io.to(room).emit("room:closed", { reason: "Host ngắt kết nối, phòng không có người" });
                     await cacheRedis.del(`room:sessions:${roomCode}`);
                   }
                }
             } catch (e) {
                 console.error("[Socket] disconnecting music room error:", e);
             }
          })();
        }
      });
    });

    /**
     * Dọn dẹp trạng thái Online vĩnh viễn
     */
    socket.on("disconnect", async () => {
      // FIX B: Xoá dứt điểm Ghost User khi tab đóng
      analyticsService.removeUserActivity(socket.id);
      try {
        // Xóa khỏi Redis ngay lập tức để Dashboard Admin cập nhật chính xác
        await cacheRedis.zrem("online_users", currentUserId);
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

  /**
   * Room heartbeat push mỗi 30 giây.
   * Sync memberCount cho tất cả active music rooms.
   */
  const roomHeartbeatInterval = setInterval(async () => {
    try {
      const activeRoomKeys = Array.from(io.sockets.adapter.rooms.keys()).filter(
        (k) => k.startsWith("music_room:"),
      );
      for (const roomKey of activeRoomKeys) {
        const roomCode = roomKey.replace("music_room:", "");
        const count = await cacheRedis.hlen(`room:sessions:${roomCode}`);
        io.to(roomKey).emit("room:heartbeat", { roomCode, memberCount: count });
      }
    } catch (err) {
      console.error("[Socket] Room heartbeat error:", err);
    }
  }, 30_000);

  roomHeartbeatInterval.unref();

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
