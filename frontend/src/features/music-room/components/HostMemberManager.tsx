import React, { useEffect, useState, useCallback } from "react";
import { Users, ShieldAlert, MicOff, Mic, UserMinus, RefreshCcw, Loader2 } from "lucide-react";
import { getMembers, kickUser } from "@/features/music-room/api/room.api";
import type { RoomMember } from "@/features/music-room/api/room.api";
import { toast } from "sonner";
import { useSocket } from "@/app/context/SocketContext";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
  memberCount?: number;
  accentColor?: string;
  hostId?: string;
}

export const HostMemberManager = ({ roomCode, memberCount, accentColor = "hsl(var(--primary))", hostId }: Props) => {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getMembers(roomCode);
      setMembers(data);
    } catch (err: any) {
      toast.error(err.message ?? "Lỗi tải danh sách thành viên");
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers, memberCount]);

  const handleKick = async (userId: string) => {
    if (confirm("Bạn có chắc chắn muốn đuổi người dùng này khỏi phòng?")) {
      try {
        await kickUser(roomCode, userId);
        toast.success("Đã kick người dùng");
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      } catch (err: any) {
        toast.error(err.message ?? "Lỗi khi kick");
      }
    }
  };

  const handleMute = (userId: string) => {
    if (confirm("Cấm chat người dùng này?")) {
      if (socket) {
        socket.emit("room:mute_user", { roomCode, targetUserId: userId });
        setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, isMuted: true } : m)));
        toast.success("Đã cấm chat");
      }
    }
  };

  const handleUnmute = (userId: string) => {
    if (confirm("Mở cấm chat cho người dùng này?")) {
      if (socket) {
        socket.emit("room:unmute_user", { roomCode, targetUserId: userId });
        setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, isMuted: false } : m)));
        toast.success("Đã mở cấm chat");
      }
    }
  };

  const [search, setSearch] = useState("");
  const filteredMembers = members.filter((m) =>
    (m.fullName || "").toLowerCase().includes(search.toLowerCase()) || 
    (m.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const visibleMembers = members.slice(0, 5);
  const hiddenCount = Math.max(0, (memberCount || members.length) - visibleMembers.length);

  return (
    <div className="flex items-center gap-2.5">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center hover:opacity-80 transition-opacity focus:outline-none" aria-label="Quản lý thành viên">
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
                    <div
                      className="size-7 overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-background transition-all duration-200 group-hover:scale-110 group-hover:z-50"
                      style={{
                        outline: isHost ? `2px solid ${accentColor}` : "2px solid hsl(var(--border) / 0.5)",
                        outlineOffset: "1px",
                      }}
                    >
                      {member.avatar ? (
                        <ImageWithFallback src={member.avatar} alt={member.fullName} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: isHost ? accentColor : "hsl(var(--primary))" }}>
                          {(member.fullName || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {isHost && (
                      <div className="absolute -top-1.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: accentColor }}>
                        <Crown className="size-2 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <div className="relative -ml-2 size-7 rounded-full glass border border-border/30 flex items-center justify-center text-[9px] font-black text-muted-foreground">
                  +{hiddenCount}
                </div>
              )}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 rounded-2xl glass-frosted border-border/50 shadow-card-lg" align="start">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Users className="size-4" /> Thành viên ({members.length})
            </h3>
            <button onClick={fetchMembers} disabled={isLoading} className="p-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCcw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm kiếm thành viên..." 
              className="h-8 pl-8 rounded-xl text-xs bg-background/50 border-border/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
            {isLoading && members.length === 0 ? (
              <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Không tìm thấy thành viên.</div>
            ) : (
              filteredMembers.map(member => {
                const isHost = member.userId === hostId;
                return (
                  <div key={member.userId} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-card/60 transition-colors group">
                    <div className="size-9 rounded-full overflow-hidden shrink-0 border border-border/50 bg-muted relative">
                      {member.avatar ? (
                        <ImageWithFallback src={member.avatar} alt={member.fullName || "User"} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-xs font-bold text-white bg-primary">
                          {(member.fullName || "U").charAt(0).toUpperCase()}
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
                      <p className="text-xs font-semibold truncate text-foreground">{member.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">@{member.username} {isHost && "(Host)"}</p>
                    </div>
                    
                    {!isHost && (
                      <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {member.isMuted ? (
                          <button onClick={() => handleUnmute(member.userId)} className="size-7 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors" title="Mở cấm chat">
                            <Mic className="size-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleMute(member.userId)} className="size-7 rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-colors" title="Cấm chat">
                            <MicOff className="size-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleKick(member.userId)} className="size-7 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center transition-colors" title="Đuổi khỏi phòng">
                          <UserMinus className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
