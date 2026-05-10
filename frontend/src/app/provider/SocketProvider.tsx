import React, { useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAppSelector } from "@/store/hooks"; // Import từ hooks.ts như đã thống nhất
import { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";
import { SocketContext } from "../context/SocketContext"; // Import Context từ file trên
import { env } from "@/config/env";

const SOCKET_URL = env.VITE_SOCKET_URL;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // 1. Khởi tạo instance
    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: token ? `Bearer ${token}` : null,
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
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
