// features/music-room/components/RoomMemberList.tsx
/**
 * Danh sách thành viên đang online trong phòng.
 * Tuân theo design system index.css — dark/light mode.
 */

import React, { memo } from "react";
import { Crown, Users, Music2 } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentRoom } from "../store/roomSlice";
import { ROOM_THEMES } from "../types/room.types";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Member {
  userId: string;
  fullName?: string;
  avatar?: string;
}

interface Props {
  members?: Member[];
}

const RoomMemberList = memo(({ members = [] }: Props) => {
  const currentRoom = useSelector(selectCurrentRoom);
  const theme = (currentRoom?.theme ?? "bar") as keyof typeof ROOM_THEMES;
  const accentColor = ROOM_THEMES[theme].accent;
  const hostId =
    typeof currentRoom?.host === "object"
      ? (currentRoom.host as any)?._id
      : currentRoom?.host;
  const memberCount = currentRoom?.memberCount ?? 0;

  const visibleMembers = members.slice(0, 5);
  const hiddenCount = Math.max(0, memberCount - visibleMembers.length);

  const [search, setSearch] = React.useState("");
  const filteredMembers = members.filter((m) =>
    (m.fullName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex items-center gap-2.5">

      {/* Avatar stack with Popover */}
      {visibleMembers.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center hover:opacity-80 transition-opacity focus:outline-none" aria-label="Xem danh sách thành viên">
              <div className="flex items-center" role="list">
                {visibleMembers.map((member, i) => {
                  const isHost = member.userId === hostId;
                  return (
                    <div
                      key={member.userId}
                      className="group relative -ml-2 first:ml-0"
                      style={{ zIndex: visibleMembers.length - i }}
                      role="listitem"
                    >
                      {/* Avatar ring */}
                      <div
                        className={cn(
                          "size-7 overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-background transition-all duration-200 group-hover:scale-110 group-hover:z-50",
                        )}
                        style={{
                          outline: isHost ? `2px solid ${accentColor}` : "2px solid hsl(var(--border) / 0.5)",
                          outlineOffset: "1px",
                        }}
                      >
                        {member.avatar ? (
                          <ImageWithFallback
                            src={member.avatar}
                            alt={member.fullName ?? "User"}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex size-full items-center justify-center text-[9px] font-black text-white"
                            style={{ backgroundColor: isHost ? accentColor : "hsl(var(--primary))" }}
                          >
                            {(member.fullName ?? "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Host crown */}
                      {isHost && (
                        <div
                          className="absolute -top-1.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: accentColor }}
                          aria-label="Host"
                        >
                          <Crown className="size-2 text-white" />
                        </div>
                      )}

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg glass px-2 py-1 text-[10px] font-semibold text-foreground shadow-floating opacity-0 transition-opacity group-hover:opacity-100 border border-border/30">
                        {member.fullName ?? "Ẩn danh"}
                        {isHost && (
                          <span className="ml-1 font-black" style={{ color: accentColor }}>
                            (Host)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Overflow badge */}
                {hiddenCount > 0 && (
                  <div
                    className="relative -ml-2 size-7 rounded-full glass border border-border/30 flex items-center justify-center text-[9px] font-black text-muted-foreground"
                  >
                    +{hiddenCount}
                  </div>
                )}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 rounded-2xl glass-frosted border-border/50 shadow-card-lg" align="start">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4" /> Thành viên ({memberCount})
              </h3>
            </div>
            
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input 
                placeholder="Tìm kiếm..." 
                className="h-8 pl-8 rounded-xl text-xs bg-background/50 border-border/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">Không tìm thấy thành viên</div>
              ) : (
                filteredMembers.map(member => {
                  const isHost = member.userId === hostId;
                  return (
                    <div key={member.userId} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-card/60 transition-colors">
                      <div className="size-8 rounded-full overflow-hidden shrink-0 bg-muted border border-border/50 relative">
                        {member.avatar ? (
                          <ImageWithFallback src={member.avatar} alt={member.fullName ?? ""} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs font-bold text-white bg-primary">
                            {(member.fullName ?? "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isHost && (
                          <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-background flex items-center justify-center">
                            <div className="size-3 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                              <Crown className="size-2 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground">{member.fullName ?? "Ẩn danh"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{isHost ? "Phòng chủ (Host)" : "Người nghe"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Count + EQ bars */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {memberCount > 0 ? (
          <>
            {/* Animated EQ bars */}
            <div className="flex items-end gap-0.5 h-3">
              {[1, 2, 3].map((b) => (
                <div
                  key={b}
                  className="w-0.5 rounded-full animate-pulse"
                  style={{
                    height: `${40 + b * 20}%`,
                    backgroundColor: accentColor,
                    animationDelay: `${b * 0.2}s`,
                    animationDuration: "1s",
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            <span className="font-bold">
              <span className="text-foreground">{memberCount}</span> đang nghe
            </span>
          </>
        ) : (
          <>
            <Users className="size-3 opacity-50" />
            <span className="opacity-50">Chờ thành viên…</span>
          </>
        )}
      </div>
    </div>
  );
});

RoomMemberList.displayName = "RoomMemberList";
export default RoomMemberList;
