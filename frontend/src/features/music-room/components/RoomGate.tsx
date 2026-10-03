import type { ReactNode } from "react";
import { Lock, LogIn, Music2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { MusicRoom } from "../types/room.types";
import { ROOM_THEMES } from "../types/room.types";

const SPRING = { type: "spring", stiffness: 340, damping: 28 } as const;

export type RoomGateKind = "login" | "password" | "full" | "blocked" | "loading" | "join";

interface Props {
  kind: RoomGateKind;
  title: string;
  description?: string;
  room?: MusicRoom | null;
  password?: string;
  onPasswordChange?: (value: string) => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}

export const RoomGate = ({
  kind,
  title,
  description,
  room,
  password = "",
  onPasswordChange,
  onPrimary,
  primaryLabel,
  onBack,
  backLabel = "Về danh sách phòng",
}: Props) => {
  if (kind === "loading") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <div className="spinner" />
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    );
  }

  const theme = room ? ROOM_THEMES[room.theme] ?? ROOM_THEMES.bar : null;
  const cover = room?.currentTrack?.coverImage || room?.coverImage;

  let icon: ReactNode = <Music2 className="size-7 text-primary" />;
  if (kind === "login") icon = <LogIn className="size-7 text-primary" />;
  if (kind === "password") icon = <Lock className="size-7 text-primary" />;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4">
      {cover && (
        <ImageWithFallback
          src={cover}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/75 to-background" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="glass-frosted shadow-floating relative z-10 w-full max-w-md rounded-3xl p-6 text-center sm:p-8"
      >
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/15">
          {icon}
        </div>
        {kind === "join" && theme && (
          <p className="text-xs font-semibold" style={{ color: theme.accent }}>
            Tham gia với vai thành viên
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

        {kind === "join" && room && (
          <>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 text-left">
              <ImageWithFallback
                src={room.currentTrack?.coverImage || "/placeholder.png"}
                alt=""
                className="size-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {room.currentTrack?.title || "Phòng đang chờ bài đầu tiên"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Host {room.host?.fullName || room.host?.username || "Host"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Users className="size-3.5" />
                {room.memberCount}/{room.maxMembers} người
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Music2 className="size-3.5" />
                {room.roomCode}
              </span>
              {!room.isPublic && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                  <Lock className="size-3.5" />
                  Riêng tư
                </span>
              )}
            </div>
          </>
        )}

        {kind === "password" && (
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onPrimary?.();
            }}
            placeholder="Mật khẩu"
            className="mt-5 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        )}

        {onPrimary && primaryLabel && (
          <button
            type="button"
            onClick={onPrimary}
            className="pressable mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-brand"
            style={theme ? { background: theme.accent } : undefined}
          >
            {primaryLabel}
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-3 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {backLabel}
          </button>
        )}
      </motion.div>
    </div>
  );
};
