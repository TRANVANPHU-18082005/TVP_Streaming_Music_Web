// features/analytics/components/ActiveUsersCard.tsx

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserCheck, Ghost, Headphones } from "lucide-react";
import { LiveBadge } from "./AnalyticsShared";

interface ActiveUsersCardProps {
  activeUsers: number; // authenticated
  activeGuests: number; // guest_ prefix (NEW)
  listeningNow: number; // sockets in track: rooms
  activeNow: number; // total socket connections
}

const AnimatedNumber = ({ value }: { value: number }) => (
  <AnimatePresence mode="popLayout">
    <motion.span
      key={value}
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="tabular-nums"
    >
      {value.toLocaleString()}
    </motion.span>
  </AnimatePresence>
);

const ActiveUsersCard = ({
  activeUsers,
  activeGuests,
  listeningNow,
  activeNow,
}: ActiveUsersCardProps) => {
  const totalOnline = activeUsers + activeGuests;

  // Tỉ lệ người đang nghe nhạc trong tổng số online
  const listeningPercent =
    totalOnline > 0 ? Math.round((listeningNow / totalOnline) * 100) : 0;

  return (
    <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-md border border-border relative overflow-hidden group h-full flex flex-col">
      {/* Background decor */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
        <Users size={140} />
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users size={16} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Concurrent Users
          </span>
        </div>
        <LiveBadge />
      </div>

      {/* Main number */}
      <div className="relative z-10 mb-1">
        <div className="text-6xl font-black tracking-tighter text-foreground leading-none flex items-end gap-0">
          <AnimatedNumber value={totalOnline} />
        </div>
        <p className="text-xs text-muted-foreground font-medium mt-1.5">
          {activeNow.toLocaleString()} socket connections total
        </p>
      </div>

      {/* Auth vs Guest split */}
      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-1.5">
            <UserCheck
              size={12}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Members
            </span>
          </div>
          <span className="text-xl font-black tabular-nums text-emerald-900 dark:text-emerald-100 leading-none">
            <AnimatedNumber value={activeUsers} />
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <div className="flex items-center gap-1.5">
            <Ghost size={12} className="text-violet-600 dark:text-violet-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
              Guests
            </span>
          </div>
          <span className="text-xl font-black tabular-nums text-violet-900 dark:text-violet-100 leading-none">
            <AnimatedNumber value={activeGuests} />
          </span>
        </div>
      </div>

      {/* Listening now bar */}
      <div className="relative z-10 mt-4 flex-1 flex flex-col justify-end">
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-1.5">
            <Headphones size={12} className="text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Listening now
            </span>
          </div>
          <span className="text-xs font-bold text-primary tabular-nums">
            {listeningNow.toLocaleString()}{" "}
            <span className="text-muted-foreground font-medium">
              ({listeningPercent}%)
            </span>
          </span>
        </div>
        <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${listeningPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveUsersCard;
