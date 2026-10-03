import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Layers, Clock, Heart, Disc3 } from "lucide-react";
import { motion } from "framer-motion";
import { IMashup, TRANSITION_META, formatMashupDuration } from "../types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useLongPress } from "@/hooks/useLongPress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Share2, FileText } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/components/ui/use-mobile";

interface MashupCardProps {
  mashup: IMashup;
  variant?: "default" | "compact" | "featured";
}

const CARD_BASE =
  "group relative flex h-72 w-full cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-border/40 bg-background/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-border/80 dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)]";

/** Mini energy curve SVG */
const EnergyCurve = ({ shorts }: { shorts?: any[] }) => {
  if (!shorts || shorts.length < 2) return null;
  const energies = shorts.map((_, i) => Math.max(0.12, Math.abs(Math.sin(i * 1.7) * 0.5 + 0.35)));
  const pts = energies.map((e, i) => {
    const x = (i / (energies.length - 1)) * 100;
    const y = 24 - e * 24;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-4 w-full opacity-70">
      <path d={`M 0,24 L ${pts.join(" L ")} L 100,24 Z`} fill="#f59e0b18" />
      <path d={`M ${pts.join(" L ")}`} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** Mini waveform bars (static decorative) */
const WaveformBars = ({ active, count = 16 }: { active: boolean; count?: number }) => (
  <div className="flex h-5 w-full items-end gap-px">
    {Array.from({ length: count }, (_, i) => {
      const h = Math.max(15, Math.abs(Math.sin(i * 1.3) * 60 + Math.cos(i * 2.7) * 20) + 20);
      return (
        <motion.div
          key={i}
          className={`flex-1 rounded-t-sm ${active ? "bg-primary" : "bg-white/30"}`}
          style={{ height: `${h}%` }}
          animate={active ? { height: [`${h}%`, `${Math.max(15, h - 20)}%`, `${h}%`] } : {}}
          transition={{ repeat: active ? Infinity : 0, duration: 0.5 + i * 0.06, ease: "easeInOut" }}
        />
      );
    })}
  </div>
);

/**
 * Reusable mashup card component.
 * - `default`: standard card with cover art, vinyl hover effect, stats
 * - `compact`: slim horizontal row
 * - `featured`: large hero card
 */
export const MashupCard = ({ mashup, variant = "default" }: MashupCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  const coverUrl = mashup.coverImage || mashup.shorts?.[0]?.short?.track?.coverImage;
  const topTransitions = [...new Set(mashup.shorts?.slice(0, 3).map(s => s.transitionType).filter(Boolean))];

  const handleClick = (e?: React.MouseEvent) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    navigate(`/mashups/${mashup._id}`);
  };

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const longPressTriggeredRef = React.useRef(false);
  const longPress = useLongPress(() => {
    longPressTriggeredRef.current = true;
    setIsDrawerOpen(true);
  }, 500);

  const { onMouseLeave: lpOnMouseLeave, ...lpRest } = longPress;

  if (variant === "compact") {
    return (
      <div
        className="group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-surface-2/60"
        onClick={handleClick}
      >
        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg">
          <ImageWithFallback src={coverUrl} className="size-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-4 fill-white text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{mashup.title}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Layers className="size-2.5" /> {mashup.shorts?.length || 0} tracks
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="size-2.5" /> {formatMashupDuration(mashup.totalDuration || 0)}
            </span>
          </div>
        </div>
        <Heart className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-red-400" />
      </div>
    );
  }

  if (variant === "featured") {
    return (
      <div
        className={cn(CARD_BASE, "justify-end")}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        {...lpRest}
        onMouseLeave={(e: any) => {
          setIsHovered(false);
          if (lpOnMouseLeave) (lpOnMouseLeave as Function)();
        }}
      >
        <ImageWithFallback src={coverUrl} className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 bg-primary/10 opacity-0 mix-blend-overlay transition-opacity duration-500 group-hover:opacity-100" />

        {/* Waveform strip */}
        <div className="absolute inset-x-6 bottom-24 opacity-80">
          <WaveformBars active={isHovered} count={24} />
        </div>

        <div className="relative z-10 p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
              <Layers className="size-3" /> Mashup Hot
            </span>
            <span className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-sm">{formatMashupDuration(mashup.totalDuration || 0)}</span>
          </div>
          <h3 className="mb-1.5 text-2xl font-black leading-tight text-white drop-shadow-md">{mashup.title}</h3>
          <p className="flex items-center gap-1.5 text-sm font-medium text-white/70">
            <span>{mashup.shorts?.length || 0} tracks</span>
            <span className="size-1 rounded-full bg-white/30" />
            <span>{mashup.createdBy?.name || "Unknown"}</span>
          </p>
        </div>

        {/* Vinyl record overlay on hover */}
        <motion.div
          className="pointer-events-none absolute -right-4 top-4"
          initial={{ opacity: 0, scale: 0.5, x: 20 }}
          animate={isHovered ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.5, x: 20 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative size-24 rounded-full border border-white/10 bg-neutral-900 shadow-2xl">
            <motion.div 
              className="absolute inset-0 rounded-full" 
              animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{
                background: "radial-gradient(circle at 50%, transparent 20%, rgba(255,255,255,0.05) 21% 22%, transparent 23%, rgba(255,255,255,0.05) 30% 31%, transparent 32%, rgba(255,255,255,0.02) 40% 41%, transparent 42%)",
              }} 
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                className="size-10 overflow-hidden rounded-full shadow-inner"
                animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <ImageWithFallback src={coverUrl} className="size-full object-cover" />
              </motion.div>
            </div>
            {/* Play overlay icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                   <Play className="ml-0.5 size-3 fill-white text-white" />
                </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Default Card ──────────────────────────────────────────────────────────
  return (
    <>
      <article
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        {...lpRest}
        onMouseLeave={(e: any) => {
          setIsHovered(false);
          if (lpOnMouseLeave) (lpOnMouseLeave as Function)();
        }}
        className={cn(
          "group cursor-pointer flex flex-col gap-3 relative",
          "album-card !overflow-visible p-2 rounded-2xl transition-all duration-300",
          "hover:bg-muted/10",
        )}
      >
        {/* Cover area */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-[18px] transition-all duration-500",
            "bg-muted border border-border/10 shadow-raised group-hover:shadow-elevated ring-1 ring-border/50",
          )}
        >
          <ImageWithFallback
            src={coverUrl}
            className="size-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />

          {/* Waveform overlay mini for Mashup feel */}
          <div className="absolute inset-x-4 bottom-14 opacity-60">
            <WaveformBars active={isHovered} count={16} />
          </div>

          {/* Duration badge */}
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-md">
            <Clock className="size-2.5 text-white/70" />
            <span className="font-mono text-[10px] font-medium text-white">{formatMashupDuration(mashup.totalDuration || 0)}</span>
          </div>

          {/* Tracks badge */}
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-primary/90 px-1.5 py-0.5 shadow-sm backdrop-blur-md">
            <Layers className="size-2.5 text-white" />
            <span className="text-[10px] font-bold text-white">{mashup.shorts?.length || 0}</span>
          </div>

          {/* PLAY BUTTON (Bottom Right morphing) */}
          <div
            className={cn(
              "absolute right-2 bottom-2 z-30 transition-all duration-300 ease-out",
              cn(
                "translate-y-3 opacity-0 scale-90",
                isMobile ? "hidden" : "group-hover:translate-y-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 group-hover:scale-100"
              )
            )}
          >
            <button
              type="button"
              className="control-btn control-btn--primary size-10 sm:size-12 shadow-glow-sm"
            >
              <Play className="size-5 ml-0.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex flex-col gap-0.5 px-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold truncate transition-colors duration-200 flex-1 text-foreground group-hover:text-primary">
              {mashup.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 justify-between">
            <p className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 min-w-0">
              <span className="truncate max-w-[120px]">{mashup.createdBy?.name || "Unknown"}</span>
              <span className="size-0.5 rounded-full bg-border shrink-0" />
              <span className="flex items-center gap-0.5 text-muted-foreground transition-colors group-hover:text-red-400">
                <Heart className="size-3 text-current" /> {(mashup.likeCount || 0).toLocaleString()}
              </span>
            </p>
            
            <div className="flex gap-1">
              {topTransitions.slice(0, 2).map(t => {
                const m = TRANSITION_META[t as keyof typeof TRANSITION_META];
                return m ? (
                  <span
                    key={t}
                    className="flex size-4 items-center justify-center rounded-[4px] border text-[8px]"
                    style={{ backgroundColor: `${m.color}15`, borderColor: `${m.color}40`, color: m.color }}
                    title={m.label}
                  >
                    {m.icon}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>
      </article>

      {/* ── Action Menu (Long press) ────────────────────────────────────────── */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="z-[100] border-border bg-background text-foreground">
            <DrawerHeader className="border-b border-border/50 pb-4 text-left">
              <DrawerTitle className="text-lg">Tùy chọn Mashup</DrawerTitle>
              <DrawerDescription className="mt-3 flex items-center gap-3">
                <ImageWithFallback src={coverUrl} className="size-10 rounded-md border border-border/50 shadow-sm" />
                <div className="flex min-w-0 flex-col">
                  <span className="line-clamp-1 text-sm font-semibold text-foreground">{mashup.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{mashup.createdBy?.name || "Unknown"}</span>
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-2 p-4">
              <button
                onClick={() => {
                  navigate(`/mashups/${mashup._id}`);
                  setIsDrawerOpen(false);
                }}
                className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Play className="ml-1 size-5" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Phát Mashup</span>
                  <span className="text-xs text-muted-foreground">Nghe trọn bộ các track</span>
                </div>
              </button>
              <button
                onClick={() => {
                  navigate(`/mashups/${mashup._id}`); // Might be same for now, but could be edit later
                  setIsDrawerOpen(false);
                }}
                className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <FileText className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Chi tiết Mashup</span>
                  <span className="text-xs text-muted-foreground">Xem các short được mix</span>
                </div>
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: mashup.title, url: window.location.href + `mashups/${mashup._id}` });
                  }
                  setIsDrawerOpen(false);
                }}
                className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <Share2 className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Chia sẻ</span>
                  <span className="text-xs text-muted-foreground">Chia sẻ Mashup này</span>
                </div>
              </button>
            </div>
            <DrawerFooter className="pb-6 pt-2">
              <DrawerClose asChild>
                <button className="w-full rounded-2xl bg-muted py-3.5 font-bold text-foreground transition-colors hover:bg-muted/80">
                  Hủy
                </button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
      );
};
