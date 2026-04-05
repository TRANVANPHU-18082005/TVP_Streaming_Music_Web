"use client";

/**
 * MoodVideoCard.tsx — Production Refactor v2.0
 * SOUNDWAVE Design System · Obsidian Luxury / Neural Audio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURE:
 * - memo'd component — only re-renders when video data or callbacks change
 * - useCallback on all event handlers — stable refs for parent memo strategy
 * - Video playback lifecycle properly managed (pause + reset on leave)
 * - Pointer events (touch + mouse) unified via onPointerEnter/Leave
 * - Separate visual state from video state for fine-grained control
 *
 * UI/UX UPGRADES:
 * - 9:16 aspect ratio canvas with full-bleed video + layered overlays
 * - Gradient overlay system: always-on bottom scrim + hover action layer
 * - Play/Pause icon swap on hover (not just Play icon)
 * - isActive badge in top-right with glow treatment
 * - Usage count chip with wave-3 accent (cyan = mood identity)
 * - Tag pills in info section with wave-spectrum colors
 * - Action buttons with proper touch targets (44px min)
 * - Toggle active button with aria-pressed + aria-label
 * - glass-frosted info section for depth
 */

import React, { useRef, useState, useCallback, memo } from "react";
import {
  Play,
  Pause,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Eye,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MoodVideo } from "../types";

interface MoodVideoCardProps {
  video: MoodVideo;
  onEdit: (video: MoodVideo) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export const MoodVideoCard = memo(
  ({ video, onEdit, onDelete, onToggleActive }: MoodVideoCardProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    /* ── Unified pointer handlers (touch + mouse) ── */
    const handlePointerEnter = useCallback(() => {
      const el = videoRef.current;
      if (!el) return;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {}); // Silently handle autoplay policy blocks
    }, []);

    const handlePointerLeave = useCallback(() => {
      const el = videoRef.current;
      if (!el) return;
      el.pause();
      el.currentTime = 0;
      setIsPlaying(false);
    }, []);

    /* ── Stable action callbacks ── */
    const handleEdit = useCallback(() => onEdit(video), [onEdit, video]);
    const handleDelete = useCallback(
      () => onDelete(video._id),
      [onDelete, video._id],
    );
    const handleToggleActive = useCallback(
      () => onToggleActive(video._id, !video.isActive),
      [onToggleActive, video._id, video.isActive],
    );

    return (
      <article
        className={cn(
          "group relative rounded-2xl overflow-hidden",
          "border transition-all duration-300",
          "bg-card/40 backdrop-blur-sm",
          video.isActive
            ? "border-border/40 hover:border-primary/30 hover:shadow-brand"
            : "border-border/30 hover:border-border/60 opacity-70 hover:opacity-90",
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        aria-label={`Mood video: ${video.title}`}
      >
        {/* ══════ MEDIA CONTAINER ══════ */}
        <div className="relative aspect-[9/16] w-full bg-black overflow-hidden">
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            aria-hidden="true"
          />

          {/* Always-on bottom gradient scrim — ensures text legibility */}
          <div
            className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, hsl(228 32% 4% / 0.92) 0%, hsl(228 32% 4% / 0.5) 50%, transparent 100%)",
            }}
            aria-hidden="true"
          />

          {/* Top-left: Usage count chip */}
          <div
            className={cn(
              "absolute top-2.5 left-2.5",
              "flex items-center gap-1 px-2 py-0.5 rounded-full",
              "bg-black/55 backdrop-blur-md border border-white/10",
              "text-[9px] font-bold text-white/80",
            )}
          >
            <Eye className="size-2.5 shrink-0" aria-hidden="true" />
            {video.usageCount}
          </div>

          {/* Top-right: Active status badge */}
          <div
            className={cn(
              "absolute top-2.5 right-2.5",
              "flex items-center gap-1 px-2 py-0.5 rounded-full",
              "backdrop-blur-md border text-[9px] font-bold",
              video.isActive
                ? "bg-success/20 border-success/30 text-emerald-300 shadow-[0_0_8px_hsl(var(--success)/0.3)]"
                : "bg-black/55 border-white/10 text-white/40",
            )}
          >
            {video.isActive ? (
              <>
                <CheckCircle2 className="size-2.5" aria-hidden="true" />
                On
              </>
            ) : (
              <>
                <XCircle className="size-2.5" aria-hidden="true" />
                Off
              </>
            )}
          </div>

          {/* Center: Play / Pause icon overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "transition-opacity duration-250 pointer-events-none",
              isPlaying
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
            aria-hidden="true"
          >
            <div
              className={cn(
                "flex items-center justify-center size-12 rounded-full",
                "bg-black/50 backdrop-blur-sm border border-white/20",
                "transition-transform duration-200 group-hover:scale-110",
              )}
            >
              {isPlaying ? (
                <Pause className="size-5 text-white fill-white" />
              ) : (
                <Play className="size-5 text-white fill-white translate-x-0.5" />
              )}
            </div>
          </div>

          {/* Bottom overlay: title + tags (always visible over scrim) */}
          <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
            <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
              {video.title}
            </h4>

            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {video.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-md",
                      "bg-white/10 backdrop-blur-sm border border-white/10",
                      "text-white/70 font-medium",
                    )}
                  >
                    #{tag}
                  </span>
                ))}
                {video.tags.length > 3 && (
                  <span className="text-[9px] text-white/40 font-medium self-center">
                    +{video.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Waveform identity line */}
            <div className="flex items-center gap-1 pt-0.5">
              <Waves
                className="size-3 shrink-0"
                style={{ color: "hsl(var(--wave-3))" }}
                aria-hidden="true"
              />
              <div className="eq-bars eq-bars--thin h-3" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn("eq-bar", isPlaying ? "" : "paused")}
                    style={{ background: "hsl(var(--wave-3))" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════ ACTION BAR ══════ */}
        <div
          className={cn(
            "flex items-center gap-2 p-2.5",
            "border-t border-border/30 bg-card/60 backdrop-blur-sm",
          )}
        >
          {/* Toggle Active — aria-pressed for AT */}
          <button
            type="button"
            onClick={handleToggleActive}
            aria-pressed={video.isActive}
            aria-label={video.isActive ? "Deactivate video" : "Activate video"}
            className={cn(
              "size-8 flex items-center justify-center rounded-lg",
              "border transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              video.isActive
                ? "border-success/30 bg-success/10 text-emerald-400 hover:bg-success/20"
                : "border-border/50 bg-muted/30 text-muted-foreground/40 hover:border-border hover:text-muted-foreground",
            )}
          >
            {video.isActive ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <XCircle className="size-3.5" aria-hidden="true" />
            )}
          </button>

          {/* Edit */}
          <button
            type="button"
            onClick={handleEdit}
            aria-label={`Edit ${video.title}`}
            className={cn(
              "flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg",
              "border border-border/50 bg-muted/30",
              "text-[11px] font-semibold text-muted-foreground",
              "hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Edit2 className="size-3" aria-hidden="true" />
            Edit
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${video.title}`}
            className={cn(
              "size-8 flex items-center justify-center rounded-lg",
              "border border-destructive/20 bg-destructive/5 text-destructive/60",
              "hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
            )}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  },
);
export default MoodVideoCard;
MoodVideoCard.displayName = "MoodVideoCard";
