// features/music-room/components/RoomCard.tsx
/**
 * Card hiển thị phòng trong trang khám phá.
 * Tuân theo design system: glass, shadow, tokens.
 * Hỗ trợ dark/light mode.
 */

import React, { memo } from "react";
import { Link } from "react-router-dom";
import { Users, Lock, Music2 } from "lucide-react";
import type { MusicRoom } from "../types/room.types";
import { ROOM_THEMES } from "../types/room.types";
import { cn } from "@/lib/utils";

interface Props {
  room: MusicRoom;
}

const RoomCard = memo(({ room }: Props) => {
  const theme = room.theme as keyof typeof ROOM_THEMES;
  const config = ROOM_THEMES[theme];
  const fillPercent = Math.round((room.memberCount / room.maxMembers) * 100);

  return (
    <Link
      to={`/rooms/${room.roomCode}`}
      id={`room-card-${room.roomCode}`}
      className="album-card block"
    >
      {/* Card surface — glass-frosted + shadow-elevated */}
      <div className="glass-frosted shadow-elevated relative overflow-hidden rounded-2xl">

        {/* Theme gradient overlay — subtle tint */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-[0.08] dark:opacity-[0.18]",
            config.gradient,
          )}
        />

        {/* Hover highlight */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-10 rounded-2xl bg-primary"
        />

        <div className="relative flex flex-col gap-3 p-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Room name */}
              <div className="mb-0.5 flex items-center gap-1.5">
                {!room.isPublic && (
                  <Lock className="size-3 shrink-0 text-muted-foreground" />
                )}
                <h3 className="truncate text-sm font-semibold text-foreground leading-tight">
                  {room.name}
                </h3>
              </div>
              {/* Theme label */}
              <p className="text-overline text-muted-foreground">{config.label}</p>
            </div>

            {/* Live pill */}
            <span className="badge badge-live shrink-0 text-[10px]">LIVE</span>
          </div>

          {/* ── Current track ── */}
          {room.currentTrack ? (
            <div className="flex items-center gap-2.5">
              {/* Album thumb */}
              <div className="relative size-9 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={room.currentTrack.coverImage || "/placeholder.png"}
                  alt={room.currentTrack.title}
                  className="size-full object-cover"
                />
                {/* Eq bars overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="eq-bars eq-bars--thin">
                    {[1, 2, 3, 4].map((b) => (
                      <div
                        key={b}
                        className="eq-bar bg-primary"
                        style={{ height: `${30 + b * 15}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-track-title truncate text-foreground">
                  {room.currentTrack.title}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Music2 className="size-3.5" />
              <p className="text-xs">Chưa phát bài nào</p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between">
            {/* Member count */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3" />
              <span className="text-xs font-medium">
                {room.memberCount}
                <span className="text-muted-foreground/60">/{room.maxMembers}</span>
              </span>
            </div>

            {/* Host avatar + name */}
            <div className="flex items-center gap-1.5">
              <div className="size-5 overflow-hidden rounded-full ring-1 ring-border">
                {room.host.avatar ? (
                  <img
                    src={room.host.avatar}
                    alt={room.host.fullName}
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-full items-center justify-center text-[9px] font-bold text-primary-foreground bg-primary"
                  >
                    {room.host.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <span className="max-w-[72px] truncate text-xs text-muted-foreground">
                {room.host.username || room.host.fullName}
              </span>
            </div>
          </div>

          {/* ── Capacity bar ── */}
          <div className="progress-track h-1">
            <div
              className="progress-fill h-full transition-all duration-500 bg-primary"
              style={{
                width: `${fillPercent}%`
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
});

RoomCard.displayName = "RoomCard";
export default RoomCard;
