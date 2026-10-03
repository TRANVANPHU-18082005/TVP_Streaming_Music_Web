// features/music-room/components/CreateRoomModal.tsx
/**
 * Modal tạo phòng nhạc mới.
 * Thiết kế tinh tế, sử dụng primary color, tương thích design system.
 */

import React, { useEffect, useState, memo } from "react";
import { X, Lock, Globe, Check } from "lucide-react";
import { searchApi } from "@/features/search";
import { useDebounce } from "@/hooks/useDebounce";
import { motion } from "framer-motion";
import type { RoomTheme } from "../types/room.types";
import { ROOM_THEMES } from "../types/room.types";
import type { CreateRoomPayload } from "../api/room.api";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onSubmit: (payload: CreateRoomPayload) => Promise<void>;
  isLoading?: boolean;
}

const CreateRoomModal = memo(({ onClose, onSubmit, isLoading }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<RoomTheme>("bar");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [queueMode, setQueueMode] = useState<"open" | "approval">("open");
  const [starterQuery, setStarterQuery] = useState("");
  const debouncedStarter = useDebounce(starterQuery, 400);
  const [starterHits, setStarterHits] = useState<{ id: string; title: string; kind: "track" | "playlist" }[]>([]);
  const [starter, setStarter] = useState<{ id: string; title: string; kind: "track" | "playlist" } | null>(null);

  useEffect(() => {
    if (!debouncedStarter.trim()) {
      setStarterHits([]);
      return;
    }
    searchApi.search({ q: debouncedStarter, limit: 5 }).then((data) => {
      const tracks = (data.tracks ?? []).slice(0, 4).map((item) => ({
        id: item._id,
        title: item.title,
        kind: "track" as const,
      }));
      const playlists = (data.playlists ?? []).slice(0, 3).map((item) => ({
        id: item._id,
        title: item.title,
        kind: "playlist" as const,
      }));
      setStarterHits([...tracks, ...playlists]);
    }).catch(() => setStarterHits([]));
  }, [debouncedStarter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      theme,
      isPublic,
      queueMode,
      password: !isPublic && password ? password : undefined,
      trackId: starter?.kind === "track" ? starter.id : undefined,
      playlistId: starter?.kind === "playlist" ? starter.id : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="glass-frosted shadow-floating relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl">
        {/* Header - Fixed */}
        <div className="relative shrink-0 border-b border-border/40 px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Tạo phòng nhạc</h2>
          <button
            id="create-room-close-btn"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
          <form id="create-room-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Room name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Tên phòng *</label>
              <input
                id="room-name-input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Nhập tên phòng..."
                maxLength={60}
                required
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Mô tả (tùy chọn)</label>
              <textarea
                id="room-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="Mô tả ngắn về phòng..."
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Theme selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Chọn không khí</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.entries(ROOM_THEMES) as [RoomTheme, (typeof ROOM_THEMES)[RoomTheme]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      id={`theme-btn-${key}`}
                      onClick={() => setTheme(key)}
                      className={cn(
                        "relative rounded-xl border p-2 transition-all duration-200",
                        theme === key
                          ? "border-primary bg-primary/10 scale-105 shadow-md"
                          : "border-border/50 hover:border-border hover:bg-muted/50",
                      )}
                    >
                      <div className={`h-6 rounded-lg bg-gradient-to-br ${config.gradient}`} />
                      <p className="mt-1 truncate text-[9px] font-medium leading-tight text-muted-foreground">
                        {config.label}
                      </p>
                      {theme === key && (
                        <div
                          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary shadow-sm"
                        >
                          <Check className="size-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Public / Private */}
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Quyền truy cập</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="room-public-btn"
                  onClick={() => { setIsPublic(true); setQueueMode("open"); }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                    isPublic
                      ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Globe className="size-4" />
                  Công khai
                </button>
                <button
                  type="button"
                  id="room-private-btn"
                  onClick={() => { setIsPublic(false); setQueueMode("approval"); }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                    !isPublic
                      ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Lock className="size-4" />
                  Riêng tư
                </button>
              </div>
            </div>

            {/* Password (chỉ khi private) */}
            {!isPublic && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <label className="mb-1.5 mt-1 block text-sm font-medium text-muted-foreground">
                  Mật khẩu phòng
                </label>
                <input
                  id="room-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu bảo vệ..."
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </motion.div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Quyền thêm bài hát</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setQueueMode("open")} className={cn("flex-1 rounded-xl border py-2 text-sm transition-all", queueMode === "open" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50")}>
                  Ai cũng được
                </button>
                <button type="button" onClick={() => setQueueMode("approval")} className={cn("flex-1 rounded-xl border py-2 text-sm transition-all", queueMode === "approval" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50")}>
                  Cần Host duyệt
                </button>
              </div>
            </div>

            <div className="pb-2">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Bài hoặc playlist mở đầu</label>
              <input
                value={starter ? starter.title : starterQuery}
                onChange={(event) => {
                  setStarter(null);
                  setStarterQuery(event.target.value);
                }}
                placeholder="Tìm bài hát hoặc playlist..."
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
              {!starter && starterHits.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-background shadow-md [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
                  {starterHits.map((hit) => (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      className="block w-full truncate px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => {
                        setStarter(hit);
                        setStarterHits([]);
                      }}
                    >
                      <span className="font-medium text-primary">{hit.kind === "playlist" ? "Playlist" : "Bài hát"}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      {hit.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="shrink-0 border-t border-border/40 p-5 bg-background/50 rounded-b-2xl">
          <button
            id="create-room-submit-btn"
            type="submit"
            form="create-room-form"
            disabled={!name.trim() || isLoading}
            className="control-btn--primary w-full rounded-xl py-3 font-semibold text-primary-foreground transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            style={
              {
                background: "hsl(var(--primary))",
                boxShadow: "0 4px 14px hsl(var(--primary) / 0.3)",
              } as React.CSSProperties
            }
          >
            {isLoading ? "Đang tạo..." : "Tạo phòng"}
          </button>
        </div>
      </div>
    </div>
  );
});

CreateRoomModal.displayName = "CreateRoomModal";
export default CreateRoomModal;
