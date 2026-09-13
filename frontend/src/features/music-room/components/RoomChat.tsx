// features/music-room/components/RoomChat.tsx
/**
 * Live chat panel cho Music Room.
 * Tuân theo design system index.css — dark/light mode.
 */

import React, { memo, useState, KeyboardEvent } from "react";
import { Send, ChevronUp, MessageSquare, Smile } from "lucide-react";
import type { RoomMessage } from "../types/room.types";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface RoomChatProps {
  messages: RoomMessage[];
  chatEndRef: React.RefObject<HTMLDivElement>;
  chatContainerRef?: React.RefObject<HTMLDivElement>;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onSendMessage: (content: string) => void;
  onLoadMore: () => void;
  accentColor: string;
  currentUserId?: string;
  hostId?: string;
  isListener?: boolean;
}

// ── Message bubble ──────────────────────────────────────────────────────────

const MessageBubble = memo(
  ({
    msg,
    isOwn,
    accentColor,
    hostId,
  }: {
    msg: RoomMessage;
    isOwn: boolean;
    accentColor: string;
    hostId?: string;
  }) => {
    const isMsgHost = msg.sender === hostId;

    // System event
    if (msg.type === "system") {
      return (
        <div className="flex justify-center my-2" role="status" aria-live="polite">
          <span className="glass border border-border/50 dark:border-border/20 text-muted-foreground text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-sm tracking-wide">
            {msg.content}
          </span>
        </div>
      );
    }

    // Floating reaction
    if (msg.type === "reaction") {
      return (
        <div className={cn("flex items-center gap-2 px-1", isOwn ? "justify-end" : "justify-start")}>
          <span className="text-[10px] font-bold text-muted-foreground glass px-2 py-0.5 rounded-full border border-border/50 dark:border-border/20">
            {msg.senderName}
          </span>
          <span className="text-2xl leading-none">{msg.reaction}</span>
        </div>
      );
    }

    // Normal text message
    return (
      <div className={cn("flex gap-2 items-end group", isOwn ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        {!isOwn && (
          <div className="size-7 sm:size-8 shrink-0 overflow-hidden rounded-full border border-border/60 dark:border-border/40 shadow-sm">
            {msg.senderAvatar ? (
              <ImageWithFallback
                src={msg.senderAvatar}
                alt={msg.senderName}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[10px] font-bold text-primary-foreground bg-primary">
                {msg.senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={cn("flex max-w-[76%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
          {/* Name + host badge */}
          {!isOwn && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                {msg.senderName}
              </span>
              {isMsgHost && (
                <span
                  className="text-[8px] px-1.5 py-px rounded-full font-black uppercase tracking-widest border"
                  style={{
                    color: accentColor,
                    borderColor: `${accentColor}44`,
                    backgroundColor: `${accentColor}18`,
                  }}
                >
                  HOST
                </span>
              )}
            </div>
          )}

          {/* Message text */}
          <div
            className={cn(
              "px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm break-words",
              isOwn
                ? "rounded-2xl rounded-br-sm text-white border border-transparent"
                : "rounded-2xl rounded-bl-sm glass border border-border/60 dark:border-border/30 text-foreground hover:bg-card/80 transition-colors"
            )}
            style={isOwn ? {
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `0 4px 12px ${accentColor}33`,
            } : undefined}
          >
            {msg.content}
          </div>
        </div>
      </div>
    );
  },
);
MessageBubble.displayName = "MessageBubble";

// ── RoomChat ─────────────────────────────────────────────────────────────────

const RoomChat = memo(
  ({
    messages,
    chatEndRef,
    chatContainerRef,
    isLoadingHistory,
    hasMoreHistory,
    onSendMessage,
    onLoadMore,
    accentColor,
    currentUserId,
    hostId,
    isListener = false,
  }: RoomChatProps) => {
    const [input, setInput] = useState("");

    const handleSend = () => {
      if (!input.trim()) return;
      onSendMessage(input.trim());
      setInput("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="flex h-full flex-col gap-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <MessageSquare className="size-4" style={{ color: accentColor }} />
            Live Chat
          </h3>
          {/* LIVE badge with ring pulse */}
          <span
            className="relative flex items-center gap-1.5 text-[9px] px-2.5 py-1 font-black uppercase tracking-widest rounded-full border"
            aria-label="Live chat đang hoạt động"
            style={{
              color: "#ef4444",
              borderColor: "#ef444444",
              backgroundColor: "#ef444415",
            }}
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
            </span>
            LIVE
          </span>
        </div>

        {/* ── Load more button ── */}
        {hasMoreHistory && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingHistory}
            className="shrink-0 mx-auto flex items-center justify-center gap-2 text-xs font-bold text-foreground/70 dark:text-muted-foreground bg-card/60 hover:bg-card shadow-sm dark:bg-transparent px-4 py-1.5 rounded-full border border-border/60 dark:border-border/20 transition-all hover:scale-105 active:scale-95 hover:text-foreground"
          >
            {isLoadingHistory ? (
              <div className="size-3 rounded-full border-2 border-foreground/40 dark:border-muted-foreground/40 border-t-foreground dark:border-t-muted-foreground animate-spin" />
            ) : (
              <ChevronUp className="size-3" />
            )}
            {isLoadingHistory ? "Đang tải..." : "Xem tin nhắn cũ hơn"}
          </button>
        )}

        {/* ── Messages list ── */}
        <div
          ref={chatContainerRef}
          className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-0.5 py-1 min-h-0"
          role="log"
          aria-label="Tin nhắn phòng"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
              <Smile className="size-8" />
              <p className="text-xs font-medium">Hãy là người đầu tiên nhắn gì đó!</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              msg={msg}
              isOwn={msg.sender === currentUserId}
              accentColor={accentColor}
              hostId={hostId}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 flex flex-col gap-1">
          <div
            className="flex items-end gap-2 bg-card/80 dark:glass border border-border dark:border-border/30 p-1.5 rounded-[1.25rem] transition-all focus-within:border-primary/60 dark:focus-within:border-primary/40 shadow-sm"
            style={{ ["--tw-ring-color" as any]: accentColor }}
          >
            <textarea
              id="room-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 300))}
              onKeyDown={handleKeyDown}
              placeholder="Nhắn gì đó… (Enter để gửi)"
              rows={1}
              aria-label="Nhập tin nhắn"
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none scrollbar-none"
              style={{ maxHeight: "80px" }}
            />
            <button
              id="room-chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "size-9 rounded-xl flex items-center justify-center shrink-0 transition-all m-0.5 shadow-sm",
                input.trim()
                  ? "text-white hover:scale-105 active:scale-95"
                  : "bg-muted/80 dark:bg-muted text-muted-foreground/80 cursor-not-allowed"
              )}
              aria-label="Gửi tin nhắn"
              style={{
                background: input.trim() ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)` : undefined,
              }}
            >
              <Send className="size-3.5 ml-0.5" />
            </button>
          </div>
          <span className="pr-1 text-right text-[10px] font-medium text-muted-foreground/40">
            {input.length}/300
          </span>
        </div>
      </div>
    );
  },
);

RoomChat.displayName = "RoomChat";
export default RoomChat;
