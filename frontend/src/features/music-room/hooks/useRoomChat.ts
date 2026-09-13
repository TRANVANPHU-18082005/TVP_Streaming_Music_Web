// features/music-room/hooks/useRoomChat.ts
/**
 * Hook quản lý chat trong phòng:
 * - Load lịch sử khi mount
 * - Phân trang khi scroll lên
 * - Realtime messages từ socket (xử lý bởi useRoomSocket)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getChatHistory } from "../api/room.api";
import {
  prependMessages,
  selectRoomMessages,
} from "../store/roomSlice";

export const useRoomChat = (roomCode: string | undefined) => {
  const dispatch = useDispatch();
  const messages = useSelector(selectRoomMessages);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  // Bug 2 fix: track nếu user đang ở gần cuối
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }, []);

  useEffect(() => {
    const el = chatEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        isAtBottomRef.current = entries[0].isIntersecting;
      },
      { root: chatContainerRef.current, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [chatEndRef, chatContainerRef]);

  // Load lịch sử chat trang đầu khi vào phòng
  useEffect(() => {
    if (!roomCode) return;

    const loadInitialHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const msgs = await getChatHistory(roomCode, 1, 50);
        dispatch(prependMessages(msgs));
        setHasMoreHistory(msgs.length === 50);
        // Scroll xuống ngay lập tức (không smooth)
        setTimeout(() => scrollToBottom(false), 100);
      } catch {
        // Lỗi im lặng — người dùng vẫn có thể dùng chat realtime
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();
  }, [roomCode, dispatch, scrollToBottom]);

  // Load thêm tin nhắn cũ (kéo lên)
  const loadMoreHistory = useCallback(async () => {
    if (!roomCode || isLoadingHistory || !hasMoreHistory) return;

    try {
      setIsLoadingHistory(true);
      // Bug 2 fix: đánh dấu user đang không ở cuối khi load more
      isAtBottomRef.current = false;
      const nextPage = historyPage + 1;
      const msgs = await getChatHistory(roomCode, nextPage, 50);
      dispatch(prependMessages(msgs));
      setHasMoreHistory(msgs.length === 50);
      setHistoryPage(nextPage);
    } catch {
      // Lỗi im lặng
    } finally {
      setIsLoadingHistory(false);
    }
  }, [roomCode, isLoadingHistory, hasMoreHistory, historyPage, dispatch]);

  // Auto scroll khi có tin nhắn mới (chỉ nếu đang ở cuối)
  useEffect(() => {
    // Bug 2 fix: chỉ scroll khi user đang ở gần cuối
    if (messages.length > 0 && isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  return {
    messages,
    chatEndRef,
    chatContainerRef,
    isLoadingHistory,
    hasMoreHistory,
    loadMoreHistory,
    scrollToBottom,
  };
};
