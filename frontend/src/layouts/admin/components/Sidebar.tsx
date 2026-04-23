import React, { memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ADMIN_PATHS } from "@/config/paths";
import { cn } from "@/lib/utils";
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
  TvMinimalPlay,
} from "lucide-react";
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      {
        label: "Mood Video",
        path: `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.VIDEO_MOOD}`,
        icon: TvMinimalPlay,
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

/* ─── Logo ─────────────────────────────────────────────────────── */
const Logo = memo(({ collapsed }: { collapsed: boolean }) => (
  <Link
    to="/"
    className={cn(
      "group flex items-center gap-2.5 shrink-0 rounded-xl",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      collapsed && "justify-center",
    )}
    aria-label="Music — Go to home"
  >
    {/* Logo mark */}
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl shrink-0",
        "size-9 transition-all duration-300",
        "bg-primary/10 border border-primary/20",
        "group-hover:bg-primary/15 group-hover:scale-105 group-hover:shadow-glow-xs",
      )}
    >
      <Avatar className="size-full rounded-xl">
        <AvatarImage
          src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
          alt=""
          aria-hidden="true"
          className="object-cover p-0.5"
        />
        <AvatarFallback className="bg-transparent font-black text-primary text-xs">
          TVP
        </AvatarFallback>
      </Avatar>

      {/* Glow dot — brand accent */}
      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary border-2 border-sidebar" />
    </div>

    {/* Wordmark */}
    {!collapsed && (
      <div className="flex flex-col leading-none select-none">
        <span className="text-[15px] font-black tracking-tight text-foreground">
          Music<span className="text-primary">.</span>
        </span>
        <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground/60 mt-0.5">
          Admin
        </span>
      </div>
    )}
  </Link>
));
Logo.displayName = "Logo";

/* ─── Nav Item ──────────────────────────────────────────────────── */
interface NavItemProps {
  label: string;
  path: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const NavItem = memo(
  ({ label, icon: Icon, isActive, isCollapsed, onClick }: NavItemProps) => (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl text-sm font-medium",
        "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        "transition-all duration-200 ease-out",
        // collapsed state
        isCollapsed ? "justify-center w-10 h-10 mx-auto px-0" : "px-3 py-2.5",
        // active vs idle
        isActive
          ? [
              "bg-primary/10 text-primary",
              "shadow-[inset_0_1px_0_hsl(var(--primary)/0.12),inset_0_-1px_0_hsl(var(--primary)/0.06)]",
            ]
          : [
              "text-sidebar-foreground/60",
              "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            ],
      )}
    >
      {/* Active left bar */}
      {isActive && !isCollapsed && (
        <span
          className={cn(
            "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full",
            "bg-gradient-to-b from-wave-1 to-wave-2",
            "shadow-[0_0_6px_hsl(var(--brand-glow)/0.5)]",
          )}
        />
      )}

      {/* Active ring for collapsed */}
      {isActive && isCollapsed && (
        <span className="absolute inset-0 rounded-xl ring-1 ring-primary/30 bg-primary/10" />
      )}

      {/* Icon */}
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-all duration-200",
          isActive
            ? "text-primary"
            : "text-sidebar-foreground/50 group-hover:text-primary group-hover:scale-110",
        )}
      />

      {/* Label */}
      {!isCollapsed && <span className="truncate tracking-tight">{label}</span>}

      {/* Hover pill for collapsed tooltip feel */}
      {isCollapsed && (
        <span
          className={cn(
            "absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none",
            "bg-popover border border-border text-foreground shadow-floating",
            "opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
            "transition-all duration-150 z-50",
          )}
        >
          {label}
        </span>
      )}
    </button>
  ),
);
NavItem.displayName = "NavItem";

/* ─── Sidebar ───────────────────────────────────────────────────── */
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
        "fixed inset-y-0 left-0 z-50 h-screen lg:static lg:z-auto",
        "flex flex-col",
        "bg-sidebar border-r border-sidebar-border",
        "transition-all duration-300 ease-out",
        isSidebarOpen
          ? "w-64 translate-x-0 shadow-[4px_0_32px_hsl(var(--shadow-color)/var(--shadow-alpha-lg))] lg:shadow-none"
          : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-[70px]" : "lg:w-64",
      )}
    >
      {/* ── HEADER ── */}
      <div
        className={cn(
          "relative flex h-16 items-center shrink-0",
          "border-b border-sidebar-border",
          isCollapsed ? "justify-center" : "justify-between px-4",
        )}
      >
        <Logo collapsed={isCollapsed} />

        {/* Close btn — mobile only */}
        {!isCollapsed && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className={cn(
              "lg:hidden flex items-center justify-center size-8 rounded-lg",
              "text-sidebar-foreground/50 hover:text-sidebar-foreground",
              "hover:bg-sidebar-accent/60 transition-all duration-150",
            )}
          >
            <X className="size-4" />
          </button>
        )}

        {/* Decorative gradient line at bottom of header */}
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      {/* ── NAV LIST ── */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar"
        aria-label="Admin navigation"
      >
        <div className="flex flex-col gap-6">
          {sidebarGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              {/* Group title */}
              {!isCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35 select-none">
                  {group.title}
                </p>
              )}
              {isCollapsed && (
                <div className="w-5 mx-auto mb-2 h-px bg-sidebar-border/50" />
              )}

              {group.items.map((item) => {
                const isActive =
                  item.path === ADMIN_PATHS.ADMIN
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <NavItem
                    key={item.label}
                    label={item.label}
                    path={item.path}
                    icon={item.icon}
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                    onClick={() => navigate(item.path)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* ── FOOTER ── */}
      <div
        className={cn(
          "border-t border-sidebar-border shrink-0",
          "bg-sidebar",
          isCollapsed
            ? "p-2 flex flex-col items-center gap-1"
            : "p-3 space-y-1",
        )}
      >
        {/* Collapse toggle — desktop */}
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
          className={cn(
            "hidden lg:flex items-center rounded-xl text-sm font-medium",
            "text-sidebar-foreground/50 hover:text-sidebar-accent-foreground",
            "hover:bg-sidebar-accent/70 transition-all duration-200",
            isCollapsed
              ? "justify-center w-10 h-10"
              : "gap-3 w-full px-3 py-2.5",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="size-4 shrink-0" />
              <span>Thu gọn</span>
            </>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
          className={cn(
            "flex items-center rounded-xl text-sm font-medium",
            "text-sidebar-foreground/50 hover:text-sidebar-accent-foreground",
            "hover:bg-sidebar-accent/70 transition-all duration-200",
            isCollapsed
              ? "justify-center w-10 h-10"
              : "gap-3 w-full px-3 py-2.5",
          )}
        >
          <div className="relative size-4 shrink-0">
            <Sun className="absolute inset-0 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute inset-0 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
          </div>
          {!isCollapsed && (
            <span>{theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}</span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
