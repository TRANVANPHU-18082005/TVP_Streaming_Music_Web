import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, User as UserIcon, Shield, Lock, ShieldCheck, Mail, Calendar, Key, AlertTriangle,
  Activity, CheckCircle2, ChevronRight, PenSquare, Eye,
  Trash2,
  Unlock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as UserType } from "../types";

// UI Components
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper/Feature components
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { UserActivityLog } from "./UserActivityLog";

interface UserDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onEdit: (user: UserType) => void;
  onBlock: (user: UserType) => void;
  onDelete: (user: UserType) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  isOpen,
  onClose,
  user,
  onEdit,
  onBlock,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [isClosing, setIsClosing] = useState(false);

  if (!isOpen || !user) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // match duration-300
  };

  const renderRoleBadge = (role: string) => {
    const roleLower = role.toLowerCase();
    if (roleLower === "admin") {
      return (
        <Badge variant="destructive" className="gap-1 shadow-sm">
          <Shield className="size-3" /> Admin
        </Badge>
      );
    }
    if (roleLower === "artist") {
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 gap-1 hover:bg-amber-200 border-amber-200 shadow-sm">
          <Mic2 className="size-3" /> Artist
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground shadow-sm">
        <UserIcon className="size-3" /> User
      </Badge>
    );
  };

  // Mock a Mic2 icon since it wasn't imported at top
  const Mic2 = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 8-9.04 9.06a2.828 2.828 0 1 0 3.98 3.98L16 12" /><circle cx="17" cy="7" r="5" /></svg>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "relative w-full max-w-md h-full bg-background shadow-2xl border-l border-border flex flex-col transition-transform duration-300 ease-in-out",
          isClosing ? "translate-x-full" : "translate-x-0"
        )}
      >
        {/* Header (Hero Info) */}
        <div className="relative bg-muted/30 p-6 pt-10 border-b border-border shrink-0 flex flex-col items-center text-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 left-4 h-8 w-8 rounded-full bg-background/50 hover:bg-background shadow-sm"
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="absolute top-4 right-4 h-8 gap-2 bg-background shadow-sm"
          >
            <PenSquare className="size-3.5" />
            <span className="hidden sm:inline">Chỉnh sửa</span>
          </Button>

          <Avatar className="size-24 border-4 border-background shadow-xl mb-4">
            <AvatarImage src={user.avatar} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {getInitialsTextAvartar(user.fullName)}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
            {user.fullName}
            {user.isVerified && <CheckCircle2 className="size-5 text-blue-500" />}
          </h2>
          <p className="text-sm text-muted-foreground mb-3 font-medium">@{user.username || user._id.slice(-6)}</p>

          <div className="flex gap-2">
            {renderRoleBadge(user.role)}
            <Badge
              variant={user.isActive ? "default" : "destructive"}
              className={cn(
                "font-medium shadow-sm",
                user.isActive
                  ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20 dark:text-emerald-400"
                  : ""
              )}
            >
              {user.isActive ? "Active" : "Banned"}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="info" className="flex-1 flex flex-col w-full" value={activeTab} onValueChange={setActiveTab}>
            <div className="px-6 pt-4 shrink-0 bg-background border-b border-border shadow-sm z-10">
              <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-1">
                <TabsTrigger value="info" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Thông tin</TabsTrigger>
                <TabsTrigger value="security" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Bảo mật</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Hoạt động</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

              {/* TAB: INFO */}
              <TabsContent value="info" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                    <UserIcon className="size-4" /> Chi tiết liên hệ
                  </h3>
                  <div className="bg-card border rounded-xl p-4 space-y-4 shadow-sm">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Email</p>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="size-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">ID Người dùng</p>
                      <p className="text-sm font-mono text-muted-foreground">{user._id}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Ngày tham gia</p>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="size-4 text-muted-foreground" />
                        {new Date(user.createdAt).toLocaleDateString("vi-VN", {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                    <PenSquare className="size-4" /> Tiểu sử
                  </h3>
                  <div className="bg-card border rounded-xl p-4 shadow-sm">
                    {user.bio ? (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{user.bio}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Người dùng này chưa có tiểu sử.</p>
                    )}
                  </div>
                </div>

                {user.role === "artist" && (
                  <Button variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5">
                    <Eye className="size-4" /> Xem hồ sơ Nghệ sĩ
                  </Button>
                )}

              </TabsContent>

              {/* TAB: SECURITY */}
              <TabsContent value="security" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="size-4" /> Trạng thái tài khoản
                  </h3>

                  <div className="bg-card border rounded-xl p-4 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Xác minh Email</span>
                        <span className="text-[11px] text-muted-foreground">Tài khoản đã được xác thực</span>
                      </div>
                      {user.isVerified ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 shadow-none border-none"><CheckCircle2 className="size-3 mr-1" /> Đã xác minh</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground shadow-none">Chưa xác minh</Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Quyền truy cập</span>
                        <span className="text-[11px] text-muted-foreground">Đăng nhập vào hệ thống</span>
                      </div>
                      {user.isActive ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 shadow-none border-none">Được phép</Badge>
                      ) : (
                        <Badge variant="destructive" className="shadow-none"><Lock className="size-3 mr-1" /> Bị chặn</Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Đổi mật khẩu</span>
                        <span className="text-[11px] text-muted-foreground">Yêu cầu đổi MK ở lần đăng nhập tới</span>
                      </div>
                      {user.mustChangePassword ? (
                        <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 shadow-none border-none">Bắt buộc</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground shadow-none">Không</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-destructive uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="size-4" /> Vùng nguy hiểm
                  </h3>

                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => onBlock(user)}
                      className={cn(
                        "w-full justify-start",
                        user.isActive
                          ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                          : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                      )}
                    >
                      {user.isActive ? <Lock className="size-4 mr-2" /> : <Unlock className="size-4 mr-2" />}
                      {user.isActive ? "Khóa tài khoản này" : "Mở khóa tài khoản"}
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => onDelete(user)}
                      className="w-full justify-start"
                    >
                      <Trash2 className="size-4 mr-2" /> Xóa vĩnh viễn tài khoản
                    </Button>
                  </div>
                </div>

              </TabsContent>

              {/* TAB: ACTIVITY */}
              <TabsContent value="activity" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <UserActivityLog user={user} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>,
    document.body
  );
};
