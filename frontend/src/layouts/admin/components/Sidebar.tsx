import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ADMIN_PATHS } from "@/config/paths";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Disc,
  LayoutDashboard,
  ListMusic,
  MessageSquare,
  Mic2,
  Moon,
  Music,
  Settings,
  Sun,
  Users,
  X,
  KeyboardMusic,
  UserCheck,
} from "lucide-react";
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- Menu Data giữ nguyên ---
const sidebarGroups = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        path: `${ADMIN_PATHS.ADMIN}`,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        label: "Songs",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.SONGS}`,
        icon: Music,
      },
      {
        label: "Albums",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.ALBUMS}`,
        icon: Disc,
      },
      {
        label: "Playlists",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.PLAYLISTS}`,
        icon: ListMusic,
      },
      {
        label: "Artists",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.ARTISTS}`,
        icon: Mic2,
      },
      {
        label: "Genres",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.GENRES}`,
        icon: KeyboardMusic,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Users",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.USERS}`,
        icon: Users,
      },
      {
        label: "Verification Artists",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.VERIFY_ARTIST}`,
        icon: UserCheck,
      },
      { label: "Comments", path: "/comments", icon: MessageSquare },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Analytics",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.ANALYTICS}`,
        icon: BarChart3,
      },
      {
        label: "Settings",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.SETTINGS}`,
        icon: Settings,
      },
    ],
  },
];

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (value: boolean) => void;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isCollapsed,
  toggleSidebar,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  return (
    <aside
      className={cn(
        // LAYOUT: Fixed on Mobile, Static on Desktop (Quan trọng để đẩy content)
        "fixed inset-y-0 left-0 z-50 h-screen lg:static lg:z-auto",
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        isSidebarOpen
          ? "w-64 translate-x-0 shadow-xl lg:shadow-none"
          : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-[70px]" : "lg:w-64",
      )}
    >
      {/* --- HEADER --- */}
      <div
        className={cn(
          "flex h-16 items-center shrink-0 border-b border-sidebar-border",
          isCollapsed ? "justify-center" : "justify-between px-4",
        )}
      >
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 to-primary/10 border border-primary/20 shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow-primary/30">
              <Avatar className="size-full rounded-xl">
                <AvatarImage
                  src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
                  alt="Logo"
                  className="object-cover p-1" // Padding nhẹ để logo không bị sát viền
                />
                <AvatarFallback className="bg-transparent font-bold text-primary">
                  TVP
                </AvatarFallback>
              </Avatar>
            </div>
          </Link>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight text-primary">
              TVP Music
            </span>
          )}
        </div>
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground/70"
          >
            <X className="size-5" />
          </Button>
        )}
      </div>

      {/* --- MENU LIST --- */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        <div className="flex flex-col gap-6">
          {sidebarGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              {!isCollapsed && (
                <h4 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.title}
                </h4>
              )}
              {group.items.map((item) => {
                const isActive =
                  item.path === ADMIN_PATHS.ADMIN
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      // Clean Active State
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isCollapsed && "justify-center px-0 w-10 h-10 mx-auto",
                    )}
                  >
                    {/* Active Indicator Bar (Left) */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-sidebar-primary" />
                    )}

                    <item.icon
                      className={cn(
                        "size-5 shrink-0 transition-colors",
                        isActive
                          ? "text-sidebar-primary"
                          : "group-hover:text-sidebar-primary",
                      )}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* --- FOOTER --- */}
      <div className="border-t border-sidebar-border p-3 space-y-2 bg-sidebar shrink-0">
        <Button
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            "hidden lg:flex w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed ? "justify-center px-0" : "justify-start gap-3",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="size-5" />
          ) : (
            <ChevronLeft className="size-5" />
          )}
          {!isCollapsed && <span>Thu gọn</span>}
        </Button>

        <Button
          variant="ghost"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed ? "justify-center px-0" : "justify-start gap-3",
          )}
        >
          <div className="relative size-5 shrink-0">
            <Sun className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          {!isCollapsed && (
            <span>{theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}</span>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
