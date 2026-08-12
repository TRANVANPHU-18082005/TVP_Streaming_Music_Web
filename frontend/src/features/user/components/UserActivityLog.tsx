import React from "react";
import { User, Activity, LogIn, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as UserType } from "../types";

interface UserActivityLogProps {
  user: UserType;
}

export const UserActivityLog: React.FC<UserActivityLogProps> = ({ user }) => {
  const activities = [
    {
      id: "joined",
      title: "Tài khoản được tạo",
      description: `Đăng ký qua ${user.authProvider || "Local"}`,
      date: new Date(user.createdAt),
      icon: <User className="size-4 text-blue-500" />,
      colorClass: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  if (user.isVerified) {
    activities.push({
      id: "verified",
      title: "Đã xác thực",
      description: "Tài khoản đã nhận được tích xanh (Verified)",
      date: new Date(user.createdAt), // Ideally this would be a separate verifiedAt date
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      colorClass: "bg-emerald-500/10 border-emerald-500/20",
    });
  }

  if (user.mustChangePassword) {
    activities.push({
      id: "password-req",
      title: "Yêu cầu đổi mật khẩu",
      description: "Tài khoản được tạo bởi admin hoặc reset mật khẩu",
      date: new Date(user.createdAt), // Or a specific flag date
      icon: <AlertCircle className="size-4 text-amber-500" />,
      colorClass: "bg-amber-500/10 border-amber-500/20",
    });
  }

  // Sort activities by date descending (mock sorting here as dates are mostly createdAt for now)
  activities.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
      {activities.map((activity, index) => (
        <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          
          {/* Icon Marker */}
          <div className={cn(
            "flex items-center justify-center size-10 rounded-full border shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors",
            activity.colorClass,
            "bg-background"
          )}>
            {activity.icon}
          </div>
          
          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col mb-1">
              <time className="text-xs font-mono text-muted-foreground mb-1">
                {activity.date.toLocaleDateString("vi-VN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <h4 className="text-sm font-bold text-foreground">{activity.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground">{activity.description}</p>
          </div>

        </div>
      ))}

      {/* End marker */}
      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
        <div className="flex items-center justify-center size-10 rounded-full border shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 bg-background text-muted-foreground">
          <Activity className="size-4" />
        </div>
      </div>
    </div>
  );
};
