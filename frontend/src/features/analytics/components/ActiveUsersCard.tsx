import { Headphones, Radio, UserCheck, Users } from "lucide-react";

interface ActiveUsersCardProps {
  activeUsers: number;
  activeGuests: number;
  listeningNow: number;
  playsThisHour: number;
}

const metrics = [
  { key: "members", label: "Thành viên", hint: "Đã đăng nhập", icon: UserCheck },
  { key: "guests", label: "Khách", hint: "Chưa đăng nhập", icon: Users },
  { key: "listening", label: "Đang nghe", hint: "Người có bài đang phát", icon: Headphones },
  { key: "plays", label: "Lượt nghe trong giờ", hint: "Giờ Việt Nam, +07:00", icon: Radio },
] as const;

const ActiveUsersCard = ({
  activeUsers,
  activeGuests,
  listeningNow,
  playsThisHour,
}: ActiveUsersCardProps) => {
  const values = {
    members: activeUsers,
    guests: activeGuests,
    listening: listeningNow,
    plays: playsThisHour,
  };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.key} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon size={14} className="text-primary" />
              <span className="text-xs font-semibold">{metric.label}</span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {values[metric.key].toLocaleString("vi-VN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
          </div>
        );
      })}
    </div>
  );
};

export default ActiveUsersCard;
