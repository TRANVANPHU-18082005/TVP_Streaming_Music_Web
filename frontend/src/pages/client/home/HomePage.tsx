import { Suspense, lazy } from "react";
import HeroSelector from "./HeroSelector";
import { useAppSelector } from "@/store/hooks";

const FeaturedAlbums = lazy(() => import("./FeaturedAlbums"));
const FeaturedPlaylists = lazy(() => import("./FeaturedPlaylists"));
const ArtistSpotlight = lazy(() => import("./ArtistSpotlight"));
const FeaturedGenres = lazy(() => import("./FeaturedGenres"));
const TopFeaturedTracks = lazy(() => import("./TopFeaturedTracks"));
const RecentlyListenedTrack = lazy(() => import("./RecentlyListenedTrack"));
const LibrarySection = lazy(() => import("./Librarysection"));
const MyPlaylist = lazy(() => import("./MyPlaylist"));
const MyFollowerArtists = lazy(() => import("./MyFollowerArtists"));

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

export function HomePage() {
  const { user } = useAppSelector((state) => state.auth); // Ensure we have user data before showing library

  return (
    <>
      <HeroSelector />
      {user && (
        <Suspense fallback={<SectionSkeleton height={220} />}>
          <RecentlyListenedTrack />
        </Suspense>
      )}
      {user && (
        <Suspense fallback={<SectionSkeleton height={220} />}>
          <LibrarySection />
        </Suspense>
      )}
      {user && (
        <Suspense fallback={<SectionSkeleton height={220} />}>
          <MyPlaylist />
        </Suspense>
      )}
      {user && (
        <Suspense fallback={<SectionSkeleton height={220} />}>
          <MyFollowerArtists />
        </Suspense>
      )}

      <Suspense fallback={<SectionSkeleton height={220} />}>
        <FeaturedAlbums />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height={220} />}>
        <FeaturedPlaylists />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height={220} />}>
        <ArtistSpotlight />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height={220} />}>
        <FeaturedGenres />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height={220} />}>
        <TopFeaturedTracks />
      </Suspense>
    </>
  );
}

export default HomePage;
