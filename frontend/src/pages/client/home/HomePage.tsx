import { Suspense, lazy, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import HeroSelector from "./HeroSelector";
import { useAppSelector } from "@/store/hooks";

const FeaturedAlbums = lazy(() => import("./FeaturedAlbums"));
const FeaturedPlaylists = lazy(() => import("./FeaturedPlaylists"));
const ArtistSpotlight = lazy(() => import("./ArtistSpotlight"));
const FeaturedGenres = lazy(() => import("./FeaturedGenres"));
const TopFeaturedTracks = lazy(() => import("./TopFeaturedTracks"));
const RecentlyListenedTrack = lazy(() => import("./RecentlyListenedTrack"));
const LibrarySection = lazy(() => import("./LibrarySection"));
const TrackSection = lazy(() => import("./TrackSection"));
const ContinueShelf = lazy(() =>
  import("@/features/for-me/components/ContinueShelf").then((mod) => ({
    default: mod.ContinueShelf,
  })),
);
const TopSevenSection = lazy(() => import("./TopSevenSection"));
const HomeSignatureStrip = lazy(() => import("./HomeSignatureStrip"));
const MashupHomeSection = lazy(() =>
  import("@/features/mashup/components/MashupHomeSection").then((mod) => ({
    default: mod.MashupHomeSection,
  })),
);

function SectionSkeleton({ height = 48 }: { height?: number }) {
  return (
    <div className="section-container">
      <div
        className="skeleton rounded-2xl w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}

/** Mỗi section tự bắt lỗi + loading: một section lỗi không làm hỏng cả trang chủ. */
function HomeSection({ height = 220, children }: { height?: number; children: ReactNode }) {
  return (
    <ErrorBoundary size="sm" className="section-container">
      <Suspense fallback={<SectionSkeleton height={height} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
export function HomePage() {
  const { user } = useAppSelector((state) => state.auth); // Ensure we have user data before showing library

  const personal = user ? (
    <>
      <HomeSection height={220}>
        <RecentlyListenedTrack />
      </HomeSection>
      <HomeSection height={280}>
        <ContinueShelf />
      </HomeSection>
      <HomeSection height={220}>
        <LibrarySection />
      </HomeSection>
    </>
  ) : null;

  return (
    <>
      {user ? personal : <HeroSelector />}
      <HomeSection height={220}>
        <HomeSignatureStrip />
      </HomeSection>
      {user ? <HeroSelector /> : null}
      <HomeSection height={220}>
        <TrackSection />
      </HomeSection>

      <HomeSection height={220}>
        <TopSevenSection />
      </HomeSection>

      <HomeSection height={220}>
        <FeaturedAlbums />
      </HomeSection>

      <HomeSection height={220}>
        <FeaturedPlaylists />
      </HomeSection>

      <HomeSection height={260}>
        <MashupHomeSection />
      </HomeSection>

      <HomeSection height={220}>
        <ArtistSpotlight />
      </HomeSection>

      <HomeSection height={220}>
        <FeaturedGenres />
      </HomeSection>

      <HomeSection height={220}>
        <TopFeaturedTracks />
      </HomeSection>
    </>
  );
}

export default HomePage;
