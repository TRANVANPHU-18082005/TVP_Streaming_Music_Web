// features/music-room/components/CreateRoomModal.tsx
/**
 * Modal tạo phòng nhạc mới.
 * Thiết kế tinh tế, sử dụng primary color, tương thích design system.
 */

import React, { useState, memo } from "react";
import { X, Lock, Globe, Check } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      theme,
      isPublic,
      password: !isPublic && password ? password : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="glass-frosted shadow-floating relative w-full max-w-md rounded-2xl p-6">
        {/* Close */}
        <button
          id="create-room-close-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-section-title mb-6 text-foreground">🎵 Tạo phòng nhạc</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                        ? "border-primary bg-primary/5 scale-105"
                        : "border-border/50 hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <div className={`h-6 rounded-lg bg-gradient-to-br ${config.gradient}`} />
                    <p className="mt-1 truncate text-[9px] font-medium leading-tight text-muted-foreground">
                      {config.label.split(" ").slice(1).join(" ")}
                    </p>
                    {theme === key && (
                      <div
                        className="absolute right-1 top-1 flex size-3 items-center justify-center rounded-full bg-primary"
                      >
                        <Check className="size-2 text-primary-foreground" />
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
                onClick={() => setIsPublic(true)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                  isPublic
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Globe className="size-4" />
                Công khai
              </button>
              <button
                type="button"
                id="room-private-btn"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                  !isPublic
                    ? "border-primary/30 bg-primary/10 text-primary"
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
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Mật khẩu phòng
              </label>
              <input
                id="room-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </motion.div>
          )}

          {/* Submit */}
          <button
            id="create-room-submit-btn"
            type="submit"
            disabled={!name.trim() || isLoading}
            className="control-btn--primary mt-4 w-full rounded-xl py-3 font-semibold text-primary-foreground transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            style={
              {
                background: "hsl(var(--primary))",
                boxShadow: "0 4px 14px hsl(var(--primary) / 0.3)",
              } as React.CSSProperties
            }
          >
            {isLoading ? "Đang tạo..." : "Tạo phòng"}
          </button>
        </form>
      </div>
    </div>
  );
});

CreateRoomModal.displayName = "CreateRoomModal";
export default CreateRoomModal;
