/**
 * TrackTitleMarquee.tsx — v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Scrolls "Track Title · MainArtist ft. Feat1, Feat2" as one composite line.
 *
 * WHY NOT reuse <MarqueeText text={...}>:
 *   MarqueeText nhận `string` — không thể nhúng <Link> (ReactNode) vào.
 *   Component này clone toàn bộ engine (ResizeObserver + CSS @keyframes inject)
 *   nhưng render nội dung composite JSX bên trong innerRef span.
 *
 * DESIGN DECISIONS:
 *   - Separator " · " (U+00B7) — chuẩn Apple Music / Spotify
 *   - Artists render dưới dạng <Link> với màu muted → click được ngay cả khi
 *     đang scroll (hover pause giúp người dùng aim chính xác)
 *   - Hover → pause animation (group-hover pattern, giống MarqueeText)
 *   - `disabled` prop cho phép parent tắt scroll (ví dụ: khi track đang active
 *     và title đã fit vừa khung)
 */

import { memo, useRef, useEffect, useState, useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Artist {
  _id: string;
  name: string;
  slug: string;
}

interface TrackTitleMarqueeProps {
  id: string;
  title: string;
  mainArtist: Artist;
  featuringArtists?: Artist[];
  className?: string;
  /** px/s — default 40 */
  speed?: number;
  /** ms pause trước khi chạy và sau khi reset — default 1400 */
  pauseMs?: number;
  /** Tắt animation, render static */
  disabled?: boolean;
  /** Style riêng cho phần title */
  titleClassName?: string;
  /** Style riêng cho phần artist suffix */
  artistClassName?: string;
}

// ─── Internal: inline artist list (không dùng ArtistDisplay để tránh flex-wrap
//     làm vỡ chiều cao của innerRef span khi đang measure scrollWidth) ────────

function ArtistSuffix({
  mainArtist,
  featuringArtists = [],
  className,
}: {
  mainArtist: Artist;
  featuringArtists?: Artist[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", className)}>
      {/* Separator */}
      <span className="mx-1 select-none opacity-30">·</span>

      {/* Main artist */}
      <Link
        to={`/artists/${mainArtist.slug}`}
        className="transition-opacity hover:opacity-100 opacity-60 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {mainArtist.name}
      </Link>

      {/* Featuring */}
      {featuringArtists.length > 0 && (
        <>
          <span className="mx-0.5 select-none opacity-30 text-[0.7em]">
            ft.
          </span>
          {featuringArtists.map((artist, index) => (
            // Dùng template string cho key để đảm bảo tính duy nhất tuyệt đối
            <span key={`feat-${artist._id}-${index}`} className="inline-flex items-baseline">
              <Link
                to={`/artists/${artist.slug}`} // Thêm chữ 's' vào artists cho đúng route
                className="transition-opacity hover:opacity-100 opacity-40 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {artist.name}
              </Link>
              {/* Comma separator */}
              {index < featuringArtists.length - 1 && (
                <span className="select-none opacity-30 mr-0.5">,</span>
              )}
            </span>
          ))}
        </>
      )}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const TrackTitleMarquee = memo(
  ({
    id,
    title,
    mainArtist,
    featuringArtists = [],
    className,
    speed = 40,
    pauseMs = 1400,
    disabled = false,
    titleClassName,
    artistClassName,
  }: TrackTitleMarqueeProps) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLSpanElement>(null);
    const [shift, setShift] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isOverflowing, setIsOverflowing] = useState(false);

    // Collision-free keyframe name per instance
    const uid = useId().replace(/:/g, "_");

    // ── Measure overflow whenever content or container size changes ──────────
    useEffect(() => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;

      const measure = () => {
        const overflow = inner.scrollWidth - outer.clientWidth;

        if (!disabled && overflow > 4) {
          // +24px extra to scroll fully past the right fade mask
          const px = overflow + 24;
          setShift(-px);
          setDuration(px / speed + (pauseMs * 2) / 1000);
          setIsOverflowing(true);
        } else {
          setShift(0);
          setDuration(0);
          setIsOverflowing(false);
        }
      };

      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(outer);
      return () => ro.disconnect();

      // Re-measure when artist list changes (different track selected)
    }, [
      title,
      mainArtist._id,
      featuringArtists.length,
      speed,
      pauseMs,
      disabled,
    ]);

    // ── Build @keyframes string ──────────────────────────────────────────────
    const pauseFrac = duration > 0 ? (pauseMs / 1000 / duration) * 100 : 0;
    const runEnd = 100 - pauseFrac;
    const animName = `_ttm_${uid}_${Math.abs(shift).toFixed(0)}`;

    const keyframes =
      isOverflowing && duration > 0
        ? `
          @keyframes ${animName} {
            0%                        { transform: translateX(0); }
            ${pauseFrac.toFixed(1)}%  { transform: translateX(0); }
            ${runEnd.toFixed(1)}%     { transform: translateX(${shift}px); }
            100%                      { transform: translateX(${shift}px); }
          }
        `
        : "";

    const shouldAnimate = isOverflowing && !disabled;

    return (
      <div
        ref={outerRef}
        className={cn(
          "group relative overflow-hidden whitespace-nowrap",
          className,
        )}
        style={
          shouldAnimate
            ? {
                // Fade the right edge so the scroll looks clean
                maskImage:
                  "linear-gradient(to right, black 0px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, black 0px, black calc(100% - 24px), transparent 100%)",
              }
            : undefined
        }
      >
        {/* Inject keyframes only when needed */}
        {shouldAnimate && <style>{keyframes}</style>}

        {/*
          Single inline-block span so ResizeObserver measures the FULL
          composite width (title + separator + artists) in one shot.
          will-change-transform → compositor thread, no layout thrash.
        */}
        <span
          ref={innerRef}
          className="inline-flex items-baseline whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
          style={
            shouldAnimate
              ? {
                  animationName: animName,
                  animationDuration: `${duration.toFixed(2)}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: "var(--marquee-play-state, running)",
                }
              : undefined
          }
        >
          {/* Track title */}
          <Link
            to={`/tracks/${id}`}
            className={cn("font-medium text-primary", titleClassName)}
          >
            {title}
          </Link>

          {/* Artist suffix — only if at least mainArtist exists */}
          <ArtistSuffix
            mainArtist={mainArtist}
            featuringArtists={featuringArtists}
            className={artistClassName}
          />
        </span>
      </div>
    );
  },
);

TrackTitleMarquee.displayName = "TrackTitleMarquee";
