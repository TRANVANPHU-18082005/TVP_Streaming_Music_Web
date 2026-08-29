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

interface MashupCardProps {
  mashup: IMashup;
  variant?: "default" | "compact" | "featured";
}

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
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-4 opacity-70">
      <path d={`M 0,24 L ${pts.join(" L ")} L 100,24 Z`} fill="#f59e0b18" />
      <path d={`M ${pts.join(" L ")}`} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** Mini waveform bars (static decorative) */
const WaveformBars = ({ active, count = 16 }: { active: boolean; count?: number }) => (
  <div className="flex items-end gap-px h-5 w-full">
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
        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2/60 cursor-pointer transition-all group"
        onClick={handleClick}
      >
        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0">
          <ImageWithFallback src={coverUrl} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{mashup.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Layers className="w-2.5 h-2.5" /> {mashup.shorts?.length || 0} tracks
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {formatMashupDuration(mashup.totalDuration || 0)}
            </span>
          </div>
        </div>
        <Heart className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors shrink-0" />
      </div>
    );
  }

  if (variant === "featured") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl cursor-pointer group aspect-[4/3] min-h-[280px]"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        {...lpRest}
        onMouseLeave={(e: any) => {
          setIsHovered(false);
          if (lpOnMouseLeave) (lpOnMouseLeave as Function)();
        }}
      >
        <ImageWithFallback src={coverUrl} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

        {/* Waveform strip */}
        <div className="absolute inset-x-6 bottom-24">
          <WaveformBars active={isHovered} count={20} />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider">
              <Layers className="w-2.5 h-2.5" /> Mashup
            </span>
            <span className="text-white/60 text-[10px] font-mono">{formatMashupDuration(mashup.totalDuration || 0)}</span>
          </div>
          <h3 className="text-white font-black text-xl leading-tight mb-1">{mashup.title}</h3>
          <p className="text-white/60 text-sm">{mashup.shorts?.length || 0} tracks • {mashup.createdBy?.name || ""}</p>
        </div>

        {/* Vinyl record overlay on hover */}
        <motion.div
          className="absolute top-4 right-4 pointer-events-none"
          initial={{ opacity: 0, scale: 0.7, rotate: 0 }}
          animate={isHovered ? { opacity: 1, scale: 1, rotate: 360 } : { opacity: 0, scale: 0.7 }}
          transition={{ duration: isHovered ? 0.4 : 0.2, rotate: { duration: 3, repeat: Infinity, ease: "linear" } }}
        >
          <div className="w-16 h-16 rounded-full bg-neutral-900 border-2 border-white/10 relative shadow-2xl">
            <div className="absolute inset-0 rounded-full" style={{
              background: "radial-gradient(circle at 50%, transparent 20%, rgba(255,255,255,0.03) 21% 22%, transparent 23%, rgba(255,255,255,0.03) 30% 31%, transparent 32%)",
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full overflow-hidden">
                <ImageWithFallback src={coverUrl} className="w-full h-full object-cover" />
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
      <div
        className="group cursor-pointer rounded-2xl border border-border/40 overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
        style={{ background: "hsl(var(--surface-1)/0.6)" }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        {...lpRest}
        onMouseLeave={(e: any) => {
          setIsHovered(false);
          if (lpOnMouseLeave) (lpOnMouseLeave as Function)();
        }}
      >
        {/* Cover area */}
        <div className="relative h-40 overflow-hidden bg-black">
          <ImageWithFallback
            src={coverUrl}
            className="w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Waveform overlay */}
          <div className="absolute inset-x-3 bottom-2">
            <WaveformBars active={isHovered} count={20} />
          </div>

          {/* Duration badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-md">
            <Clock className="w-2.5 h-2.5 text-white/70" />
            <span className="text-[10px] text-white font-mono">{formatMashupDuration(mashup.totalDuration || 0)}</span>
          </div>

          {/* Tracks badge */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-primary/80 backdrop-blur px-2 py-0.5 rounded-md">
            <Layers className="w-2.5 h-2.5 text-white" />
            <span className="text-[10px] text-white font-bold">{mashup.shorts?.length || 0}</span>
          </div>

          {/* Hovering play button */}
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center shadow-xl"
            >
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </motion.div>
          </div>

          {/* Vinyl disc on hover */}
          <motion.div
            className="absolute top-3 right-14 pointer-events-none"
            animate={isHovered ? { rotate: 360, opacity: 0.9 } : { rotate: 0, opacity: 0 }}
            transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.3 } }}
          >
            <Disc3 className="w-8 h-8 text-white/50" />
          </motion.div>
        </div>

        {/* Info */}
        <div className="p-3.5 space-y-2.5">
          <div>
            <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{mashup.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{mashup.createdBy?.name || ""}</p>
          </div>

          {/* Energy curve */}
          <EnergyCurve shorts={mashup.shorts} />

          {/* Stats & transitions */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Heart className="w-3 h-3" /> {(mashup.likeCount || 0).toLocaleString()}
            </span>
            <div className="flex gap-1 ml-auto">
              {topTransitions.slice(0, 2).map(t => {
                const m = TRANSITION_META[t as keyof typeof TRANSITION_META];
                return m ? (
                  <span
                    key={t}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                    style={{ backgroundColor: `${m.color}15`, borderColor: `${m.color}40`, color: m.color }}
                  >
                    {m.icon}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Menu (Long press) ────────────────────────────────────────── */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="bg-background text-foreground border-border z-[100]">
            <DrawerHeader className="text-left border-b border-border/50 pb-4">
              <DrawerTitle className="text-lg">Tùy chọn Mashup</DrawerTitle>
              <DrawerDescription className="flex items-center gap-3 mt-3">
                <ImageWithFallback src={coverUrl} className="w-10 h-10 rounded-md shadow-sm border border-border/50" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-foreground line-clamp-1 text-sm">{mashup.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{mashup.createdBy?.name || "Unknown"}</span>
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  navigate(`/mashups/${mashup._id}`);
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 ml-1" fill="currentColor" />
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
                className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 text-foreground">
                  <FileText className="w-5 h-5" />
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
                className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 text-foreground">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Chia sẻ</span>
                  <span className="text-xs text-muted-foreground">Chia sẻ Mashup này</span>
                </div>
              </button>
            </div>
            <DrawerFooter className="pt-2 pb-6">
              <DrawerClose asChild>
                <button className="w-full py-3.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold transition-colors">
                  Hủy
                </button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
      );
};
