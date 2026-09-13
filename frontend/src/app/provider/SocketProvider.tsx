import React, { useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAppSelector } from "@/store/hooks"; // Import từ hooks.ts như đã thống nhất
import { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";
import { SocketContext } from "../context/SocketContext"; // Import Context từ file trên
import { env } from "@/config/env";

const SOCKET_URL = env.SOCKET_URL;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const { token, user } = useAppSelector((state) => state.auth);

  // Ngăn chặn race condition: khi user thay đổi (đăng nhập/đăng xuất), 
  // reset state socket ngay lập tức trước khi render children
  const currentUserId = user?._id || user?.id;
  const [prevUserId, setPrevUserId] = useState(currentUserId);
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setIsConnected(false);
    setSocket(null);
  }
  console.log(user)
  useEffect(() => {
    // 1. Khởi tạo instance
    const socketInstance = io(SOCKET_URL, {
      forceNew: true, // Thêm dòng này để KHÔNG dùng lại kết nối cũ
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: token ? `Bearer ${token}` : null,
      },
      query: {
        userId: currentUserId || "",
      },
    });

    // 2. Setup Listeners
    socketInstance.on("connect", () => {
      console.log("✅ Socket Connected:", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("❌ Socket Disconnected:", reason);
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("⚠️ Socket Error:", err.message);
    });

    // 3. Connect
    socketInstance.connect();
    setSocket(socketInstance);

    // 4. Cleanup
    return () => {
      // console.log("🧹 Cleaning up socket...");
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    };
  }, [token, currentUserId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
