/**
 * @file ForMeHeader.tsx
 * @description Header chuyên dụng cho trang For Me.
 *
 * Behavior:
 * - Hiển thị khi vào trang, tự động ẩn sau 3 giây không có tương tác.
 * - Hiện lại khi: chạm màn hình, di chuyển chuột, hoặc kéo từ trên xuống (swipe down).
 * - Glassmorphism dark style để hoà vào nền đen của Feed.
 * - Tích hợp mobile nav drawer từ Header chính.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Menu,
  X,
  Home,
  Users,
  Disc3,
  ListMusic,
  LogIn,
  Sparkles,
  LayoutDashboard,
  KeyboardMusic,
  ChartBar,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { CLIENT_PATHS } from "@/config/paths";
import { useAppSelector } from "@/store/hooks";
import { UserProfile } from "@/features/user";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const HIDE_DELAY_MS = 3000;
const HEADER_HEIGHT = 64;
const DRAWER_TOP_GAP = 8;

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEMS (đồng bộ với Header.tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface NavItemDef {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  path: string;
}

const NAV_ITEMS: readonly NavItemDef[] = [
  { label: "Trang chủ", shortLabel: "Home", icon: Home, path: CLIENT_PATHS.HOME },
  { label: "Bảng xếp hạng", shortLabel: "BXH", icon: ChartBar, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.CHART_TOP}` },
  { label: "Dành cho tôi", shortLabel: "For Me", icon: Sparkles, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.FOR_ME}` },
  { label: "Nghệ sĩ", shortLabel: "NS", icon: Users, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.ARTISTS}` },
  { label: "Đĩa nhạc", shortLabel: "Đĩa", icon: Disc3, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.ALBUMS}` },
  { label: "Playlist", shortLabel: "PL", icon: ListMusic, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.PLAYLISTS}` },
  { label: "Thể loại", shortLabel: "TL", icon: KeyboardMusic, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.GENRES}` },
  { label: "Cài đặt", shortLabel: "ST", icon: Settings, path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.SETTINGS}` },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const SP_DRAWER = { type: "spring", stiffness: 380, damping: 34 } as const;
const SP_ICON = { type: "spring", stiffness: 440, damping: 28 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL LOCK
// ─────────────────────────────────────────────────────────────────────────────

function lockScroll(lock: boolean) {
  if (typeof window === "undefined") return;
  if (lock) {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--scrollbar-width", `${sw}px`);
    document.documentElement.classList.add("scroll-locked");
  } else {
    document.documentElement.classList.remove("scroll-locked");
    document.documentElement.style.removeProperty("--scrollbar-width");
  }
}

if (typeof document !== "undefined") {
  const id = "__header-scroll-lock-style__";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `.scroll-locked { overflow: hidden; padding-right: var(--scrollbar-width, 0px); }`;
    document.head.appendChild(s);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCAPE KEY HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useEscapeKey(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handler(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, handler]);
}

// ─────────────────────────────────────────────────────────────────────────────
// HAMBURGER
// ─────────────────────────────────────────────────────────────────────────────

const Hamburger = memo<{ open: boolean; onToggle: () => void }>(
  ({ open, onToggle }) => (
    <motion.button
      type="button"
      aria-label={open ? "Đóng menu" : "Mở menu"}
      aria-expanded={open}
      aria-controls="for-me-mobile-drawer"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-center w-9 h-9 rounded-full",
        "bg-white/10 backdrop-blur-md border border-white/20 text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      )}
      whileTap={{ scale: 0.88 }}
      transition={SP_ICON}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.span
            key="x"
            initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
            transition={SP_ICON}
          >
            <X className="size-4" aria-hidden="true" />
          </motion.span>
        ) : (
          <motion.span
            key="menu"
            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
            transition={SP_ICON}
          >
            <Menu className="size-4" aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  ),
);
Hamburger.displayName = "Hamburger";

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER NAV LINK
// ─────────────────────────────────────────────────────────────────────────────

const DrawerNavLink = memo<{
  item: NavItemDef;
  active: boolean;
  onClose: () => void;
}>(({ item, active, onClose }) => (
  <Link
    to={item.path}
    onClick={onClose}
    aria-current={active ? "page" : undefined}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150",
      "text-[13.5px] font-semibold",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      active
        ? "bg-primary/10 text-primary border border-primary/15"
        : "text-foreground/75 hover:bg-muted hover:text-foreground",
    )}
  >
    <div
      className={cn(
        "flex items-center justify-center size-8 rounded-lg shrink-0 transition-colors",
        active ? "bg-primary/15" : "bg-muted",
      )}
      aria-hidden="true"
    >
      <item.icon
        className={cn("size-4", active ? "text-primary" : "text-muted-foreground")}
      />
    </div>
    {item.label}
  </Link>
));
DrawerNavLink.displayName = "DrawerNavLink";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE DRAWER
// ─────────────────────────────────────────────────────────────────────────────

interface MobileDrawerProps {
  items: readonly NavItemDef[];
  isActive: (path: string) => boolean;
  user: UserProfile | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const MobileDrawer: FC<MobileDrawerProps> = memo(
  ({ items, isActive, user, onClose, onNavigate }) => {
    useEscapeKey(onClose, true);
    const allItems = useMemo(() => items, [items]);

    return (
      <>
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Panel */}
        <motion.div
          id="for-me-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          key="drawer"
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.99 }}
          transition={SP_DRAWER}
          className={cn(
            "fixed left-3 right-3 z-50",
            "rounded-2xl bg-background/98 backdrop-blur-2xl",
            "border border-border/50 shadow-2xl shadow-black/30 overflow-hidden",
          )}
          style={{ top: HEADER_HEIGHT + DRAWER_TOP_GAP }}
        >
          <div
            className="flex flex-col overflow-y-auto overscroll-contain scrollbar-thin"
            style={{
              maxHeight: `calc(100dvh - ${HEADER_HEIGHT + DRAWER_TOP_GAP * 2}px)`,
            }}
          >
            {/* Nav links */}
            <div className="p-3">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.15em] px-3 py-2">
                Điều hướng
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {allItems.map((item, i) => (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, ...SP_DRAWER }}
                  >
                    <DrawerNavLink
                      item={item}
                      active={isActive(item.path)}
                      onClose={onClose}
                    />
                  </motion.div>
                ))}

                {user?.role === "admin" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: allItems.length * 0.03, ...SP_DRAWER }}
                  >
                    <Link
                      to="/admin"
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150",
                        "text-[13.5px] font-semibold text-foreground/75",
                        "hover:bg-muted hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      )}
                    >
                      <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                        <LayoutDashboard className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      Admin
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="h-px bg-border/40 mx-3" aria-hidden="true" />

            <div className="p-3 space-y-1.5">
              {/* Theme toggle */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/50">
                <span className="text-[13px] font-semibold text-foreground/70">Giao diện</span>
                <ModeToggle />
              </div>

              {/* Auth */}
              {!user ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onClose(); onNavigate("/login"); }}
                    className="h-10 rounded-xl font-semibold border-border/60 bg-transparent"
                  >
                    <LogIn className="size-3.5 mr-1.5" aria-hidden="true" />
                    Đăng nhập
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { onClose(); onNavigate("/register"); }}
                    className="h-10 rounded-xl font-bold shadow-md shadow-primary/20"
                  >
                    <Sparkles className="size-3.5 mr-1.5 fill-current" aria-hidden="true" />
                    Đăng ký
                  </Button>
                </div>
              ) : (
                <motion.div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.12 }}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={user.avatar} alt={user.fullName} className="object-cover" />
                    <AvatarFallback className="text-xs font-black bg-primary/20 text-primary">
                      {user.fullName?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{user.fullName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </motion.div>
              )}
            </div>
            <div className="pb-2" />
          </div>
        </motion.div>
      </>
    );
  },
);
MobileDrawer.displayName = "MobileDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// FOR ME HEADER
// ─────────────────────────────────────────────────────────────────────────────

export const ForMeHeader = memo(() => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const location = useLocation();

  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef(0);

  // ── Auto-hide logic ────────────────────────────────────────────────────────

  const showHeader = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const events: (keyof DocumentEventMap)[] = ["mousemove", "click", "keydown", "touchstart"];
    events.forEach((e) => document.addEventListener(e, showHeader, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, showHeader));
  }, [showHeader]);

  // ── Swipe down ─────────────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 40) showHeader();
  }, [showHeader]);

  // ── Drawer ─────────────────────────────────────────────────────────────────

  const handleToggleMenu = useCallback(() => setMenuOpen((p) => !p), []);
  const handleCloseMenu = useCallback(() => setMenuOpen(false), []);

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Scroll lock while drawer open
  useEffect(() => {
    lockScroll(menuOpen);
    return () => lockScroll(false);
  }, [menuOpen]);

  // Active path check
  const isActive = useCallback(
    (path: string) =>
      path === CLIENT_PATHS.HOME
        ? location.pathname === path
        : location.pathname.startsWith(path),
    [location.pathname],
  );

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence>
          {visible && (
            <motion.header
              key="for-me-header"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={SPRING}
              className="pointer-events-auto w-full"
            >
              {/* Glass dark background */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/40 to-transparent backdrop-blur-sm" />

              <div className="relative flex items-center justify-between px-2 md:px-4 pt-2 md:pt-2 pb-2 md:pb-4 h-12 md:h-14">
                {/* Left: Hamburger + Logo */}
                <div className="flex items-center gap-2">

                  <Link to="/" className="flex items-center gap-2">
                    <Avatar className="size-7 md:size-9 rounded-lg">
                      <AvatarImage
                        src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
                        alt="TVP Music"
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-black">
                        TVP
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </div>

                {/* Right: Search */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => navigate("/search")}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white"
                    aria-label="Tìm kiếm"
                  >
                    <Search className="w-4 h-4" />
                  </motion.button>
                  <Hamburger open={menuOpen} onToggle={handleToggleMenu} />

                </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Swipe hint dot — shows when header is hidden */}
        <AnimatePresence>
          {!visible && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <MobileDrawer
            items={NAV_ITEMS}
            isActive={isActive}
            user={user}
            onClose={handleCloseMenu}
            onNavigate={navigate}
          />
        )}
      </AnimatePresence>
    </>
  );
});
