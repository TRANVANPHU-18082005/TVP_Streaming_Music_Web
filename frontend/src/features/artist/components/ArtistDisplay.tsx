// components/ArtistDisplay.tsx — Production v2.0
// Upgraded: memo, cn() for className composition, stable ArtistChip key,
// text-overflow truncate for player variant, "feat." label cleaner.
import { memo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Artist {
  _id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
}

type Variant = "list" | "player" | "detail";

interface ArtistDisplayProps {
  mainArtist: Artist;
  featuringArtists?: Artist[];
  variant?: Variant;
  className?: string;
}

// ─── Shared: one clickable artist chip ──────────────────────────────────────

const ArtistChip = memo(
  ({
    artist,
    isMain,
    variant,
  }: {
    artist: Artist;
    isMain: boolean;
    variant: Variant;
  }) => {
    if (variant === "detail") {
      return (
        <Link
          to={`/artists/${artist.slug}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border text-xs transition-colors",
            "border-white/10 hover:border-white/30 hover:text-white text-track-meta",
            isMain ? "font-medium text-white border-white/20" : "text-white/60",
          )}
        >
          {artist.avatarUrl && (
            <img
              src={artist.avatarUrl}
              alt={artist.name}
              className="h-5 w-5 rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          {artist.name}
        </Link>
      );
    }

    // list & player variants
    return (
      <Link
        to={`/artists/${artist.slug}`}
        className={cn(
          "rounded text-xs text-truncate ",
          isMain ? "font-medium text-track-meta" : "text-track-meta",
        )}
      >
        {artist.name}
      </Link>
    );
  },
);
ArtistChip.displayName = "ArtistChip";

// ─── Separator label ─────────────────────────────────────────────────────────

const FeatLabel = memo(({ variant }: { variant: Variant }) => (
  <span
    className={cn(
      "select-none",
      variant === "detail"
        ? "text-[11px] text-white/30"
        : "text-[10px] text-muted-foreground/50",
    )}
    aria-hidden="true"
  >
    ft.
  </span>
));
FeatLabel.displayName = "FeatLabel";

// ─── Main component ──────────────────────────────────────────────────────────

export const ArtistDisplay = memo(
  ({
    mainArtist,
    featuringArtists = [],
    variant = "list",
    className = "",
  }: ArtistDisplayProps) => {
    const hasFeaturing = featuringArtists.length > 0;

    return (
      <span
        className={cn(
          "flex items-center",
          variant === "detail" ? "gap-1.5" : "gap-0.5",
          className,
        )}
      >
        {/* ── Main artist ──────────────────────────────────────────────────── */}
        <ArtistChip artist={mainArtist} isMain variant={variant} />

        {/* ── Featuring artists ────────────────────────────────────────────── */}
        {hasFeaturing && (
          <>
            <FeatLabel variant={variant} />

            {featuringArtists.map((artist, index) => (
              <span key={artist._id} className="inline-flex items-center">
                <ArtistChip artist={artist} isMain={false} variant={variant} />
                {/* comma between featuring artists, never after the last */}
                {index < featuringArtists.length - 1 && (
                  <span
                    className="text-xs text-white/30 -ml-0.5 select-none text-track-meta text-truncate"
                    aria-hidden="true"
                  >
                    ,
                  </span>
                )}
              </span>
            ))}
          </>
        )}
      </span>
    );
  },
);

ArtistDisplay.displayName = "ArtistDisplay";
export default ArtistDisplay;
