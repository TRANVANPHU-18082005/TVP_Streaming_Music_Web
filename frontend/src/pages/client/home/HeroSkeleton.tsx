// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON — mirrors exact Hero grid layout
// ─────────────────────────────────────────────────────────────────────────────
export const HeroSkeleton = () => {
  return (
    <section
      className="relative min-h-[88dvh] flex items-center overflow-hidden bg-background"
      aria-label="Đang tải album nổi bật"
      aria-busy="true"
    >
      {/* Subtle shimmer background */}
      <div className="absolute inset-0 bg-mesh-deep opacity-40" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 w-full">
        <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-20 items-center">
          {/* Artwork skeleton */}
          <div className="lg:col-span-5 flex justify-center mb-14 lg:mb-0">
            <div
              className="skeleton skeleton-cover w-[200px] sm:w-[270px] lg:w-[360px] xl:w-[400px]"
              style={{ borderRadius: "1.75rem" }}
            />
          </div>

          {/* Text skeleton */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-4 w-full">
            <div className="flex gap-2 items-center">
              <div className="skeleton skeleton-text w-28" />
              <div className="skeleton skeleton-pill w-16 h-5" />
            </div>
            <div
              className="skeleton w-full max-w-[480px] h-20 sm:h-28"
              style={{ borderRadius: "1rem" }}
            />
            <div className="skeleton skeleton-text w-44" />
            <div className="skeleton skeleton-text w-full max-w-[360px]" />
            <div className="skeleton skeleton-text w-3/4 max-w-[260px]" />
            <div className="flex items-center gap-3 pt-2">
              <div className="skeleton skeleton-btn w-36" />
              <div className="skeleton skeleton-avatar size-12" />
              <div className="skeleton skeleton-avatar size-12" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
