import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, ChevronRight, Sparkles, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useMashupFeed } from "../hooks/useMashups";
import { MashupCard } from "./MashupCard";
import { IMashup } from "../types";
import { useAppSelector } from "@/store/hooks";

/**
 * MashupHomeSection — Featured mashup section for HomePage.
 * Shows a horizontally scrollable row of mashup cards with a "Tạo Mashup" CTA.
 */
export const MashupHomeSection = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector(state => state.auth);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useMashupFeed(8);
  const mashups: IMashup[] = data?.pages?.flatMap(p => p.data?.feed ?? []) ?? [];

  // Show skeleton while loading
  if (isLoading) {
    return (
      <section className="section-container">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton h-7 w-40 rounded-xl" />
          <div className="skeleton h-5 w-24 rounded-lg" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl shrink-0" style={{ width: 200, height: 260 }} />
          ))}
        </div>
      </section>
    );
  }

  // Don't render if no mashups
  if (!mashups.length && !isLoading) return null;

  return (
    <section className="section-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Icon badge */}
          <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black font-display tracking-tight leading-tight flex items-center gap-2">
              Mashup Hot
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 rounded-full bg-red-400 inline-block"
              />
            </h2>
            <p className="text-xs text-muted-foreground">Những bản DJ remix được yêu thích nhất</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* CTA: tạo mashup */}
          {user && (
            <button
              onClick={() => navigate("/mashups/create")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo Mashup
            </button>
          )}
          {/* See all */}
          <button
            onClick={() => navigate("/mashups/feed")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors font-medium group"
          >
            Xem tất cả
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 no-scrollbar"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {/* Featured card (first one, larger) */}
        {mashups.length > 0 && (
          <div className="shrink-0 w-56 sm:w-64" style={{ scrollSnapAlign: "start" }}>
            <MashupCard mashup={mashups[0]} variant="featured" />
          </div>
        )}

        {/* Rest as default cards */}
        {mashups.slice(1).map((mashup, i) => (
          <motion.div
            key={mashup._id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="shrink-0 w-44 sm:w-48"
            style={{ scrollSnapAlign: "start" }}
          >
            <MashupCard mashup={mashup} variant="default" />
          </motion.div>
        ))}

        {/* "Tạo Mashup của bạn" CTA card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="shrink-0 w-44 sm:w-48"
          style={{ scrollSnapAlign: "start" }}
        >
          <button
            onClick={() => navigate(user ? "/mashups/create" : "/login")}
            className="w-full h-full min-h-[220px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary group"
          >
            <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center px-4">
              <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">Tạo Mashup</p>
              <p className="text-[11px] text-muted-foreground mt-1">Remix nhạc theo phong cách DJ của riêng bạn</p>
            </div>
          </button>
        </motion.div>
      </div>

      {/* Bottom nav hint */}
      <div className="flex justify-center mt-3">
        <button
          onClick={() => navigate("/mashups/feed")}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
        >
          <Layers className="w-3.5 h-3.5" />
          Khám phá tất cả Mashup
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
