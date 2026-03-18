import React, { useState, useEffect, useRef } from "react";
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
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSelector } from "@/store/hooks";

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Trang chủ", icon: Home, path: CLIENT_PATHS.HOME },
  {
    label: "Bảng xếp hạng",
    icon: ChartBar,
    path: CLIENT_PATHS.CLIENT + CLIENT_PATHS.CHART_TOP,
  },
  {
    label: "Nghệ sĩ",
    icon: Users,
    path: CLIENT_PATHS.CLIENT + CLIENT_PATHS.ARTISTS,
  },
  {
    label: "Đĩa nhạc",
    icon: Disc3,
    path: CLIENT_PATHS.CLIENT + CLIENT_PATHS.ALBUMS,
  },
  {
    label: "Playlist",
    icon: ListMusic,
    path: CLIENT_PATHS.CLIENT + CLIENT_PATHS.PLAYLISTS,
  },
  {
    label: "Thể loại",
    icon: KeyboardMusic,
    path: CLIENT_PATHS.CLIENT + CLIENT_PATHS.GENRES,
  },
] as const;

// ─── Spring presets ───────────────────────────────────────────────────────────
const SPRING_NAV = { type: "spring", bounce: 0.18, duration: 0.55 } as const;
const SPRING_DRAWER = { type: "spring", stiffness: 380, damping: 34 } as const;

// ─────────────────────────────────────────────────────────────────────────────
export function Header() {
  const { user } = useAppSelector((s) => s.auth);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // mobile search overlay
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Scroll-driven header opacity ─────────────────────────────────────────
  const { scrollY } = useScroll();
  const headerBg = useTransform(scrollY, [0, 60], [0, 1]); // 0→1 opacity multiplier

  // ── Close menu on route change ────────────────────────────────────────────
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // ── Lock body scroll when drawer is open ─────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, searchOpen]);

  // ── Focus search input when overlay opens ────────────────────────────────
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchQuery("");
      setMenuOpen(false);
      setSearchOpen(false);
    }
  };

  // ── Active path helper ────────────────────────────────────────────────────
  const isActive = (path: string) =>
    path === CLIENT_PATHS.HOME
      ? location.pathname === path
      : location.pathname.startsWith(path);

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
      >
        {/* Background layer — blurs + darkens as user scrolls */}
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/50 pointer-events-none"
          style={{ opacity: headerBg }}
        />
        {/* Fallback solid bg so it's never fully transparent on hard reload */}
        <div className="absolute inset-0 bg-background/60 pointer-events-none" />

        <div className="relative container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          {/* ── LEFT: Logo + Desktop Nav ─────────────────────────────── */}
          <div className="flex items-center gap-6 lg:gap-8">
            {/* Logo */}
            <Link
              to="/"
              className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg shrink-0"
            >
              <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border border-primary/20 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-primary/25 group-hover:shadow-md">
                <Avatar className="size-full rounded-xl">
                  <AvatarImage
                    src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
                    alt="Logo"
                    className="object-cover p-0.5"
                  />
                  <AvatarFallback className="bg-transparent font-black text-primary text-xs">
                    TVP
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Brand name — hidden on very small screens */}
              <span className="hidden sm:block text-[15px] font-black tracking-tight text-foreground leading-none">
                Music
                <span className="text-primary">.</span>
              </span>
            </Link>

            {/* Desktop nav pill bar */}
            <nav
              aria-label="Main navigation"
              className="hidden lg:flex items-center gap-0.5 bg-muted/50 p-1 rounded-full border border-border/40"
            >
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "relative px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-primary shadow-sm shadow-primary/30 z-0"
                        transition={SPRING_NAV}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {active && <item.icon className="size-3.5 shrink-0" />}
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── RIGHT: Search + Actions ──────────────────────────────── */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop search — md+ */}
            <form
              onSubmit={handleSearch}
              className="relative hidden md:flex items-center group w-[220px] lg:w-[260px] xl:w-[300px]"
            >
              <Search className="absolute left-3.5 size-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors z-10 pointer-events-none" />
              <Input
                placeholder="Tìm kiếm nhạc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10 pr-4 h-9 rounded-full w-full",
                  "bg-muted/60 border-border/50",
                  "text-[13px] font-medium placeholder:text-muted-foreground/50",
                  "focus-visible:bg-background focus-visible:border-primary/40",
                  "focus-visible:ring-2 focus-visible:ring-primary/12",
                  "transition-all duration-200",
                )}
              />
            </form>

            {/* Mobile search button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className="md:hidden flex items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <Search className="size-5" />
            </button>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-border/60 mx-0.5" />

            {/* Theme toggle — hidden on mobile (available in drawer) */}
            <div className="hidden sm:block">
              <ModeToggle />
            </div>

            {/* Auth — desktop */}
            {user ? (
              <UserDropdown user={user} navigate={navigate} />
            ) : (
              <>
                {/* Ghost login — tablet+ */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="hidden md:flex font-semibold text-[13px] text-muted-foreground hover:text-foreground h-9 px-3 rounded-full"
                >
                  Đăng nhập
                </Button>

                {/* Sign up CTA */}
                <Button
                  size="sm"
                  onClick={() => navigate("/register")}
                  className="hidden lg:flex items-center gap-1.5 rounded-full h-9 px-4 font-bold text-[13px] shadow-md shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="size-3.5 fill-current" />
                  Đăng ký
                </Button>
              </>
            )}

            {/* Hamburger — mobile / tablet */}
            <button
              type="button"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((p) => !p)}
              className="lg:hidden flex items-center justify-center size-9 rounded-full text-foreground hover:bg-accent transition-all active:scale-95"
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <X className="size-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Menu className="size-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE SEARCH OVERLAY
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-background/96 backdrop-blur-2xl flex flex-col md:hidden"
          >
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-primary pointer-events-none z-10" />
                <Input
                  ref={searchInputRef}
                  placeholder="Tìm nhạc, nghệ sĩ, album..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "pl-11 pr-12 h-12 rounded-2xl w-full",
                    "bg-muted/60 border-border/50",
                    "text-base font-medium placeholder:text-muted-foreground/50",
                    "focus-visible:bg-background focus-visible:border-primary/50",
                    "focus-visible:ring-2 focus-visible:ring-primary/15",
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </form>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                Huỷ
              </button>
            </div>

            {/* Hint */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-20">
              <div className="size-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Mic2 className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground/60 font-medium">
                Nhập để tìm bài hát, nghệ sĩ hay album
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE NAV DRAWER
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            />

            {/* Drawer panel — slides down from top */}
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={SPRING_DRAWER}
              className="fixed top-[65px] left-3 right-3 z-50 lg:hidden rounded-2xl bg-background/98 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-black/20 overflow-hidden"
            >
              <div className="flex flex-col max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain">
                {/* Nav links */}
                <div className="p-3">
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.15em] px-3 py-2">
                    Điều hướng
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {NAV_ITEMS.map((item, i) => {
                      const active = isActive(item.path);
                      return (
                        <motion.div
                          key={item.path}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: i * 0.035,
                            type: "spring",
                            stiffness: 400,
                            damping: 28,
                          }}
                        >
                          <Link
                            to={item.path}
                            onClick={() => setMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                              "text-[13.5px] font-semibold",
                              active
                                ? "bg-primary/10 text-primary border border-primary/15"
                                : "text-foreground/75 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center size-8 rounded-lg shrink-0",
                                active ? "bg-primary/15" : "bg-muted",
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "size-4",
                                  active
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                            </div>
                            {item.label}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Admin link */}
                  {user?.role === "admin" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: NAV_ITEMS.length * 0.035 }}
                      className="mt-1.5 pt-2 border-t border-border/40"
                    >
                      <Link
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13.5px] font-semibold text-foreground/75 hover:bg-muted hover:text-foreground transition-all"
                      >
                        <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                          <LayoutDashboard className="size-4 text-muted-foreground" />
                        </div>
                        Admin Dashboard
                      </Link>
                    </motion.div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-border/40 mx-3" />

                {/* Bottom: Theme + Auth */}
                <div className="p-3 space-y-1.5">
                  {/* Theme row */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/50">
                    <span className="text-[13px] font-semibold text-foreground/70">
                      Giao diện
                    </span>
                    <ModeToggle />
                  </div>

                  {/* Auth buttons */}
                  {!user ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/login");
                        }}
                        className="h-10 rounded-xl font-semibold border-border/60 bg-transparent"
                      >
                        <LogIn className="size-3.5 mr-1.5" />
                        Đăng nhập
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/register");
                        }}
                        className="h-10 rounded-xl font-bold shadow-md shadow-primary/20"
                      >
                        <Sparkles className="size-3.5 mr-1.5 fill-current" />
                        Đăng ký
                      </Button>
                    </div>
                  ) : (
                    /* Logged-in user mini card */
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
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
                    </div>
                  )}
                </div>

                {/* Safe-area bottom spacing */}
                <div className="pb-2" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
