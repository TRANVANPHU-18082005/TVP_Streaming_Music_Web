import React, { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAppSelector } from "@/store/hooks"; // Import từ hooks.ts như đã thống nhất
import { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";
import { SocketContext, type SocketStatus } from "../context/SocketContext"; // Import Context từ file trên
import { env } from "@/config/env";

const SOCKET_URL = env.SOCKET_URL;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const { token, user, isAuthChecking } = useAppSelector((state) => state.auth);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  // Ngăn chặn race condition: khi user thay đổi (đăng nhập/đăng xuất), 
  // reset state socket ngay lập tức trước khi render children
  const currentUserId = user?._id || user?.id;
  const [prevUserId, setPrevUserId] = useState(currentUserId);
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setIsConnected(false);
    setStatus("connecting");
    setSocket(null);
  }

  useEffect(() => {
    // Chờ refresh-token xong. Kết nối sớm bị hủy giữa chừng và Chrome báo WebSocket failed.
    if (isAuthChecking) return;

    // Polling trước, rồi nâng lên websocket. Không ép websocket-only.
    const socketInstance = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: (callback) => {
        const currentToken = tokenRef.current;
        callback({ token: currentToken ? `Bearer ${currentToken}` : null });
      },
    });
    socketRef.current = socketInstance;

    // 2. Setup Listeners
    socketInstance.on("connect", () => {
      setIsConnected(true);
      setStatus("connected");
    });

    socketInstance.on("disconnect", (reason) => {
      setIsConnected(false);
      // Client chủ động ngắt thì không cần banner
      if (reason === "io client disconnect") return;
      setStatus("reconnecting");
    });

    socketInstance.on("connect_error", (err) => {
      console.error("⚠️ Socket Error:", err.message);
      setStatus((prev) => (prev === "failed" ? prev : "reconnecting"));
    });

    // Manager events (reconnect_attempt / reconnect_failed) nằm trên socketInstance.io
    socketInstance.io.on("reconnect_attempt", () => {
      setStatus("reconnecting");
    });
    socketInstance.io.on("reconnect_failed", () => {
      setStatus("failed");
    });

    // 3. Connect
    socketInstance.connect();
    setSocket(socketInstance);

    // 4. Cleanup
    return () => {
      socketInstance.io.off("reconnect_attempt");
      socketInstance.io.off("reconnect_failed");
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      if (socketRef.current === socketInstance) socketRef.current = null;
    };
  }, [currentUserId, isAuthChecking]);

  // Có mạng lại sau khi đã bỏ cuộc -> tự thử kết nối lại
  const reconnect = useCallback(() => {
    const instance = socketRef.current;
    if (!instance || instance.connected) return;
    setStatus("connecting");
    instance.connect();
  }, []);

  useEffect(() => {
    const onOnline = () => {
      const instance = socketRef.current;
      if (instance && !instance.connected) reconnect();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [reconnect]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, status, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};
