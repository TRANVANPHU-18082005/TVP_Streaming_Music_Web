import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
  type FC,
  type RefCallback,
} from "react";
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
  Mic2,
  type LucideIcon,
  Settings,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLIENT_PATHS } from "@/config/paths";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import UserDropdown from "@/features/user/components/UserDropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSelector } from "@/store/hooks";
import { UserProfile } from "@/features/user";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_HEIGHT = 64; // px — syncs CSS var --navbar-height
const DRAWER_TOP_GAP = 8; // px — space between header bottom and drawer
const NAV_FULL_THRESHOLD = 520; // px — nav width below this → icon-only tier

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEMS
// Extended with shortLabel for future compact tier if needed.
// ─────────────────────────────────────────────────────────────────────────────

interface NavItemDef {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  path: string;
}

const NAV_ITEMS: readonly NavItemDef[] = [
  {
    label: "Trang chủ",
    shortLabel: "Home",
    icon: Home,
    path: CLIENT_PATHS.HOME,
  },
  {
    label: "Bảng xếp hạng",
    shortLabel: "BXH",
    icon: ChartBar,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.CHART_TOP}`,
  },
  {
    label: "Nghệ sĩ",
    shortLabel: "NS",
    icon: Users,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.ARTISTS}`,
  },
  {
    label: "Đĩa nhạc",
    shortLabel: "Đĩa",
    icon: Disc3,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.ALBUMS}`,
  },
  {
    label: "Playlist",
    shortLabel: "PL",
    icon: ListMusic,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.PLAYLISTS}`,
  },
  {
    label: "Thể loại",
    shortLabel: "TL",
    icon: KeyboardMusic,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.GENRES}`,
  },
  {
    label: "Cài đặt",
    shortLabel: "ST",
    icon: Settings,
    path: `${CLIENT_PATHS.CLIENT}${CLIENT_PATHS.SETTINGS}`,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — module scope, zero allocation per render
// ─────────────────────────────────────────────────────────────────────────────

const SP_NAV = { type: "spring", bounce: 0.18, duration: 0.52 } as const;
const SP_DRAWER = { type: "spring", stiffness: 380, damping: 34 } as const;
const SP_ICON = { type: "spring", stiffness: 440, damping: 28 } as const;
const SP_LABEL = { type: "spring", stiffness: 300, damping: 26 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL LOCK — compensates scrollbar width to prevent layout shift
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
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/** Focus input immediately on mount via rAF (no setTimeout jank). */
function useFocusOnMount<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((node: T | null) => {
    if (node) requestAnimationFrame(() => node.focus());
  }, []);
}

/** Calls handler on Escape key, only when `active`. */
function useEscapeKey(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, handler]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV TIER TYPE
// FULL  → icon + full label (≥ NAV_FULL_THRESHOLD px)
// ICON  → icon only + title tooltip (< NAV_FULL_THRESHOLD px)
// ─────────────────────────────────────────────────────────────────────────────

type NavTier = "full" | "icon";

// ─────────────────────────────────────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────────────────────────────────────

const Logo = memo(() => (
  <Link
    to="/"
    className="group flex items-center gap-2.5 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    aria-label="Music — Go to home"
  >
    <div
      className={cn(
        "relative flex size-9 items-center justify-center rounded-xl shrink-0",
        "bg-gradient-to-br from-primary/25 via-primary/10 to-transparent",
        "border border-primary/20 shadow-sm transition-all duration-300",
        "group-hover:scale-105 group-hover:shadow-md group-hover:shadow-primary/25",
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
    </div>
    <span className="hidden sm:block text-[15px] font-black tracking-tight text-brand leading-none select-none">
      Music<span className="text-primary">.</span>
    </span>
  </Link>
));
Logo.displayName = "Logo";

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEM — tier-aware, animated label
//
// Two visual states:
//   FULL: [icon] [label] — standard pill item
//   ICON: [icon] only    — icon sized up slightly, native title tooltip
//
// Active pill uses Framer layoutId="nav-pill" for smooth slide animation
// across items. This works correctly in both tiers since the pill is
// positioned absolute and fills the link's bounds.
// ─────────────────────────────────────────────────────────────────────────────

const NavItem = memo<{ item: NavItemDef; active: boolean; tier: NavTier }>(
  ({ item, active, tier }) => {
    const Icon = item.icon;
    const isIconOnly = tier === "icon";

    return (
      <Link
        to={item.path}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        title={isIconOnly ? item.label : undefined}
        className={cn(
          "relative flex items-center justify-center gap-1.5 rounded-full",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
          isIconOnly ? "size-8" : "px-3.5 py-1.5",
        )}
      >
        {/* Active pill background */}
        {active && (
          <motion.div
            layoutId="nav-pill"
            className="absolute inset-0 rounded-full bg-primary shadow-sm shadow-primary/30 z-0"
            transition={SP_NAV}
          />
        )}

        <span className="relative z-10 flex items-center gap-1.5 overflow-hidden">
          {/* Icon — always present, size adapts */}
          <Icon
            className={cn(
              "shrink-0 transition-[width,height] duration-200",
              isIconOnly ? "size-[15px]" : "size-3.5",
            )}
            aria-hidden="true"
          />

          {/* Label — animated in/out on tier switch */}
          <AnimatePresence initial={false}>
            {!isIconOnly && (
              <motion.span
                key="label"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 160 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={SP_LABEL}
                className="text-[13px] font-semibold whitespace-nowrap overflow-hidden block"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </Link>
    );
  },
);
NavItem.displayName = "NavItem";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP NAV — ResizeObserver-driven tier
//
// Measures its own contentRect width and switches tier:
//   ≥ NAV_FULL_THRESHOLD (520px) → "full"
//   <  NAV_FULL_THRESHOLD        → "icon"
//
// Why not Tailwind breakpoints: viewport width ≠ nav available width.
// The nav's available space changes as other header elements resize
// (UserDropdown appears, search bar grows, etc.). ResizeObserver fires
// on the nav element's own layout, so the tier is always accurate.
//
// flex-shrink on the nav means it yields to the Logo first.
// ─────────────────────────────────────────────────────────────────────────────

const DesktopNav = memo<{
  items: readonly NavItemDef[];
  isActive: (p: string) => boolean;
}>(({ items, isActive }) => {
  const navRef = useRef<HTMLElement>(null);
  const [tier, setTier] = useState<NavTier>("full");

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setTier(w >= NAV_FULL_THRESHOLD ? "full" : "icon");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      className={cn(
        "hidden md:flex items-center gap-0.5 p-1 rounded-full",
        "bg-muted/50 border border-border/40",
        "flex-shrink min-w-0",
      )}
    >
      {items.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={isActive(item.path)}
          tier={tier}
        />
      ))}
    </nav>
  );
});
DesktopNav.displayName = "DesktopNav";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP SEARCH BAR — lg+ only (FIX 3)
// At md, SearchIconButton replaces this to save ~180px.
// ─────────────────────────────────────────────────────────────────────────────

const DesktopSearchBar = memo<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}>(({ value, onChange, onSubmit }) => (
  <form
    onSubmit={onSubmit}
    role="search"
    aria-label="Search music"
    className="relative hidden lg:flex items-center group w-[220px] xl:w-[280px]"
  >
    <Search
      className="absolute left-3.5 size-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors z-10 pointer-events-none"
      aria-hidden="true"
    />
    <Input
      type="search"
      placeholder="Tìm kiếm nhạc..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Search"
      className={cn(
        "pl-10 pr-4 h-9 rounded-full w-full",
        "bg-muted/60 border-border/50",
        "text-[13px] font-medium placeholder:text-muted-foreground/50",
        "focus-visible:bg-background focus-visible:border-primary/40",
        "focus-visible:ring-2 focus-visible:ring-primary/15",
        "transition-all duration-200",
      )}
    />
  </form>
));
DesktopSearchBar.displayName = "DesktopSearchBar";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH ICON BUTTON — md only, opens MobileSearchOverlay (FIX 3)
// md:flex lg:hidden — appears between sm and lg, replaced by SearchBar at lg+
// ─────────────────────────────────────────────────────────────────────────────

const SearchIconButton = memo<{ onClick: () => void }>(({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Search"
    className={cn(
      "hidden md:flex lg:hidden items-center justify-center size-9 rounded-full",
      "text-muted-foreground hover:text-foreground hover:bg-accent",
      "transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    )}
  >
    <Search className="size-[18px]" aria-hidden="true" />
  </button>
));
SearchIconButton.displayName = "SearchIconButton";

// ─────────────────────────────────────────────────────────────────────────────
// HAMBURGER — mobile only (md:hidden)
// ─────────────────────────────────────────────────────────────────────────────

const Hamburger = memo<{ open: boolean; onToggle: () => void }>(
  ({ open, onToggle }) => (
    <motion.button
      type="button"
      aria-label={open ? "Đóng menu" : "Mở menu"}
      aria-expanded={open}
      aria-controls="mobile-drawer"
      onClick={onToggle}
      className={cn(
        "md:hidden flex items-center justify-center size-9 rounded-full",
        "text-foreground hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "transition-colors duration-150",
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
            <X className="size-5" aria-hidden="true" />
          </motion.span>
        ) : (
          <motion.span
            key="menu"
            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
            transition={SP_ICON}
          >
            <Menu className="size-5" aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  ),
);
Hamburger.displayName = "Hamburger";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE SEARCH OVERLAY (FIX 3)
//
// Changed md:hidden → lg:hidden so this overlay serves TWO triggers:
//   1. Mobile search icon (< md)
//   2. SearchIconButton at md (768–1023px)
//
// At lg+, the full DesktopSearchBar renders inline — this overlay is hidden.
// ─────────────────────────────────────────────────────────────────────────────

const MobileSearchOverlay = memo<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}>(({ value, onChange, onSubmit, onClose }) => {
  const focusRef = useFocusOnMount<HTMLInputElement>();
  useEscapeKey(onClose, true);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] bg-background/96 backdrop-blur-2xl flex flex-col lg:hidden"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Search"
          className="flex-1 relative"
        >
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-primary pointer-events-none z-10"
            aria-hidden="true"
          />
          <Input
            ref={focusRef}
            type="search"
            placeholder="Tìm nhạc, nghệ sĩ, album..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Search"
            className={cn(
              "pl-11 pr-12 h-12 rounded-2xl w-full",
              "bg-muted/60 border-border/50 text-base font-medium",
              "placeholder:text-muted-foreground/50",
              "focus-visible:bg-background focus-visible:border-primary/50",
              "focus-visible:ring-2 focus-visible:ring-primary/15",
            )}
          />
          <AnimatePresence>
            {value && (
              <motion.button
                type="button"
                onClick={() => onChange("")}
                aria-label="Clear"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SP_ICON}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="size-4" aria-hidden="true" />
              </motion.button>
            )}
          </AnimatePresence>
        </form>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
        >
          Huỷ
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-20">
        <div
          className="size-14 rounded-2xl bg-muted/60 flex items-center justify-center"
          aria-hidden="true"
        >
          <Mic2 className="size-7 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground/60 font-medium">
          Nhập để tìm bài hát, nghệ sĩ hay album
        </p>
      </div>
    </motion.div>
  );
});
MobileSearchOverlay.displayName = "MobileSearchOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER NAV LINK — single item inside MobileDrawer
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
        className={cn(
          "size-4",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
    </div>
    {item.label}
  </Link>
));
DrawerNavLink.displayName = "DrawerNavLink";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE DRAWER — slides down from header
// md:hidden — only present in mobile mode (< 768px)
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

    // FIX 4: no [...items] spread — items is stable module-scope const
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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />

        {/* Panel */}
        <motion.div
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          key="drawer"
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.99 }}
          transition={SP_DRAWER}
          className={cn(
            "fixed left-3 right-3 z-50 md:hidden",
            "rounded-2xl bg-background/98 backdrop-blur-2xl",
            "border border-border/50 shadow-2xl shadow-black/20 overflow-hidden",
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
                        <LayoutDashboard
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
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
                <span className="text-[13px] font-semibold text-foreground/70">
                  Giao diện
                </span>
                <ModeToggle />
              </div>

              {/* Auth */}
              {!user ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onNavigate("/login");
                    }}
                    className="h-10 rounded-xl font-semibold border-border/60 bg-transparent"
                  >
                    <LogIn className="size-3.5 mr-1.5" aria-hidden="true" />
                    Đăng nhập
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      onNavigate("/register");
                    }}
                    className="h-10 rounded-xl font-bold shadow-md shadow-primary/20"
                  >
                    <Sparkles
                      className="size-3.5 mr-1.5 fill-current"
                      aria-hidden="true"
                    />
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
                    <AvatarImage
                      src={user.avatar}
                      alt={user.fullName}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-xs font-black bg-primary/20 text-primary">
                      {user.fullName?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user.email}
                    </p>
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
// HEADER — main component
// ─────────────────────────────────────────────────────────────────────────────

export function Header() {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Scroll-driven glass opacity — MotionValue pipeline, zero React setState
  const { scrollY } = useScroll();
  const headerGlassOpacity = useTransform(scrollY, [0, 72], [0, 1]);

  // Close overlays on route change
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Body scroll lock
  useEffect(() => {
    lockScroll(menuOpen || searchOpen);
    return () => lockScroll(false);
  }, [menuOpen, searchOpen]);

  // Active path check — memoised per pathname
  const isActive = useCallback(
    (path: string) =>
      path === CLIENT_PATHS.HOME
        ? location.pathname === path
        : location.pathname.startsWith(path),
    [location.pathname],
  );

  // Stable handler refs
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setQuery("");
      setMenuOpen(false);
      setSearchOpen(false);
    },
    [query, navigate],
  );

  const handleCloseMenu = useCallback(() => setMenuOpen(false), []);
  const handleCloseSearch = useCallback(() => setSearchOpen(false), []);
  const handleToggleMenu = useCallback(() => setMenuOpen((p) => !p), []);
  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          HEADER BAR
      ════════════════════════════════════════════════════════════════════ */}
      <motion.header
        initial={{ y: -72 }}
        animate={{ y: 0 }}
        transition={{
          type: "spring",
          stiffness: 340,
          damping: 30,
          delay: 0.05,
        }}
        className="sticky top-0 z-50 w-full"
        style={{ height: HEADER_HEIGHT }}
      >
        {/* Scroll-driven glass — opacity driven by MotionValue, no setState */}
        <motion.div
          className="absolute inset-0 bg-background/82 backdrop-blur-xl border-b border-border/50 pointer-events-none"
          style={{ opacity: headerGlassOpacity }}
        />
        {/* Baseline bg visible at page top */}
        <div className="absolute inset-0 bg-background/55 pointer-events-none" />

        <div className="relative container mx-auto flex h-full items-center gap-3 px-4 sm:px-6">
          {/*
           * LEFT — Logo + DesktopNav
           * flex-1 min-w-0: column fills available space, allows nav to shrink
           * overflow-hidden: prevents label animation from overflowing during tier switch
           * Nav has flex-shrink internally → yields to Logo first
           */}
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 overflow-hidden">
            <Logo />
            <DesktopNav items={NAV_ITEMS} isActive={isActive} />
          </div>

          {/*
           * RIGHT — Search + Auth + Hamburger
           * shrink-0: this column never compresses
           */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Full search bar — lg+ only (FIX 3) */}
            <DesktopSearchBar
              value={query}
              onChange={setQuery}
              onSubmit={handleSearch}
            />

            {/* Search icon — md only, opens overlay (FIX 3) */}
            <SearchIconButton onClick={handleOpenSearch} />

            {/* Mobile search trigger — < md only */}
            <button
              type="button"
              onClick={handleOpenSearch}
              aria-label="Mở tìm kiếm"
              className={cn(
                "md:hidden flex items-center justify-center size-9 rounded-full",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              )}
            >
              <Search className="size-5" aria-hidden="true" />
            </button>

            {/* Separator + ModeToggle — md+ only (FIX 5) */}
            <div
              className="hidden md:block w-px h-5 bg-border/60 mx-0.5"
              aria-hidden="true"
            />
            <div className="hidden md:block">
              <ModeToggle />
            </div>

            {/* Auth — md+ only */}
            {user ? (
              <UserDropdown user={user} />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="hidden md:flex font-semibold text-[13px] text-muted-foreground hover:text-foreground h-9 px-3 rounded-full"
                >
                  Đăng nhập
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/register")}
                  className={cn(
                    "hidden md:flex items-center gap-1.5 rounded-full h-9 px-4",
                    "font-bold text-[13px]",
                    "shadow-md shadow-primary/20 hover:shadow-primary/30",
                    "hover:scale-[1.02] active:scale-[0.98] transition-all duration-150",
                  )}
                >
                  <Sparkles
                    className="size-3.5 fill-current"
                    aria-hidden="true"
                  />
                  Đăng ký
                </Button>
              </>
            )}

            {/* Hamburger — < md only */}
            <Hamburger open={menuOpen} onToggle={handleToggleMenu} />
          </div>
        </div>
      </motion.header>

      {/* ════════════════════════════════════════════════════════════════════
          SEARCH OVERLAY — serves mobile + md SearchIconButton (FIX 3)
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {searchOpen && (
          <MobileSearchOverlay
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            onClose={handleCloseSearch}
          />
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE DRAWER — < md only
      ════════════════════════════════════════════════════════════════════ */}
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
}

export default Header;
