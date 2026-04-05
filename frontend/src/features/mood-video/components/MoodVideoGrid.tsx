"use client";

/**
 * MoodVideoGrid.tsx — Production Refactor v2.0
 * SOUNDWAVE Design System · Obsidian Luxury / Neural Audio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURE:
 * - memo'd orchestrator — parent filter/sort changes don't re-render grid if
 *   videos array reference is stable
 * - renderContent() state machine replaces chained ternaries
 * - SkeletonGrid extracted as memo — pure shimmer, never needs re-render
 * - EmptyState extracted as memo — only re-renders when onAddClick changes
 * - VideoGridList extracted as memo — re-renders only on videos array change
 * - useCallback on onAddClick guard so EmptyState stays memo-stable
 * - staggerDelay capped at 700ms so large grids don't feel dead
 *
 * UI/UX UPGRADES:
 * - Skeleton uses .skeleton token from index.css (wave shimmer, not just opacity pulse)
 * - Skeleton has proper 9:16 aspect ratio + rounded-2xl matching real card
 * - Empty state: wave-3 (cyan) glow orb + divider-glow + animated badge
 * - Grid gap responsive: 3 → 4 → 5 → 6 columns across breakpoints
 * - Card entry stagger animation capped at 700ms
 */

import React, { memo } from "react";
import { VideoOff, Plus, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoodVideo } from "../types";
import { MoodVideoCard } from "./MoodVideoCard";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MoodVideoGridProps {
  videos: MoodVideo[];
  isLoading: boolean;
  onEdit: (video: MoodVideo) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onAddClick: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_COUNT = 12;

/** Cap stagger so the 12th card isn't 1.2s delayed */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID — .skeleton token wave shimmer, 9:16 aspect ratio
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonGrid = memo(() => (
  <div
    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4"
    role="status"
    aria-label="Đang tải mood videos"
    aria-busy="true"
  >
    {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
      <div key={i} className="space-y-0" aria-hidden="true">
        {/* Video area — 9:16 ratio */}
        <div
          className="skeleton rounded-t-2xl rounded-b-none"
          style={{ aspectRatio: "9/16" }}
        />
        {/* Action bar stub */}
        <div
          className={cn(
            "h-12 rounded-b-2xl border-t border-border/20",
            "skeleton",
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        />
      </div>
    ))}
  </div>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — wave-3 cyan identity + ambient glow orb
// Mirrors PlaylistFilter / AlbumPage empty state card pattern
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ onAddClick }: { onAddClick: () => void }) => (
  <div
    role="status"
    aria-label="Không có Mood Video nào"
    className={cn(
      "relative flex flex-col items-center justify-center",
      "py-20 px-6 rounded-3xl text-center overflow-hidden",
      "border-2 border-dashed border-border/40",
      "bg-muted/5",
    )}
  >
    {/* Ambient glow orb — wave-3 cyan */}
    <div
      className="absolute rounded-full blur-3xl pointer-events-none"
      style={{
        width: 280,
        height: 280,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background:
          "radial-gradient(circle, hsl(186 95% 58%) 0%, transparent 70%)",
        opacity: 0.06,
      }}
      aria-hidden="true"
    />

    {/* Icon */}
    <div className="relative mb-5">
      <div
        className={cn(
          "size-16 rounded-2xl flex items-center justify-center",
          "glass border border-border/40 shadow-elevated",
        )}
      >
        <VideoOff
          className="size-7 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
      {/* Floating badge */}
      <div
        className={cn(
          "absolute -top-1.5 -right-1.5",
          "badge badge-muted text-[9px] px-1.5 py-0.5",
        )}
      >
        <Clapperboard className="size-2.5" aria-hidden="true" />0 videos
      </div>
    </div>

    <h3 className="text-base font-bold text-foreground mb-1.5">
      No Mood Videos found
    </h3>
    <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-6">
      Try adjusting your filters, or upload a new Canvas video to get started.
    </p>

    {/* Divider glow */}
    <div className="divider-glow w-32 mb-6" />

    <button
      type="button"
      onClick={onAddClick}
      aria-label="Upload new mood video"
      className={cn(
        "btn-primary btn-base gap-2 h-10 px-6 rounded-xl",
        "shadow-brand",
      )}
    >
      <Plus className="size-4" aria-hidden="true" />
      Upload New Video
    </button>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO GRID LIST — isolated so only this re-renders when videos change
// ─────────────────────────────────────────────────────────────────────────────

const VideoGridList = memo(
  ({
    videos,
    onEdit,
    onDelete,
    onToggleActive,
  }: {
    videos: MoodVideo[];
    onEdit: (video: MoodVideo) => void;
    onDelete: (id: string) => void;
    onToggleActive: (id: string, isActive: boolean) => void;
  }) => (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
      role="list"
      aria-label="Danh sách mood videos"
    >
      {videos.map((video, index) => (
        <div
          key={video._id}
          role="listitem"
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: `${staggerDelay(index)}ms` }}
        >
          <MoodVideoCard
            video={video}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        </div>
      ))}
    </div>
  ),
);
VideoGridList.displayName = "VideoGridList";

// ─────────────────────────────────────────────────────────────────────────────
// MOOD VIDEO GRID — orchestrator
// renderContent() state machine replaces chained ternaries
// ─────────────────────────────────────────────────────────────────────────────

export const MoodVideoGrid = memo<MoodVideoGridProps>(
  ({ videos, isLoading, onEdit, onDelete, onToggleActive, onAddClick }) => {
    const renderContent = () => {
      if (isLoading) return <SkeletonGrid />;
      if (videos.length === 0) return <EmptyState onAddClick={onAddClick} />;
      return (
        <VideoGridList
          videos={videos}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
        />
      );
    };

    return <div className="w-full">{renderContent()}</div>;
  },
);
export default MoodVideoGrid;
MoodVideoGrid.displayName = "MoodVideoGrid";
