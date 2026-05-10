import React, { Suspense, lazy } from "react";
import { RecentlyListenedTrack } from "@/pages/client/home/RecentlyListenedTrack";
import MyPlaylist from "@/pages/client/home/MyPlaylist";
import LibrarySection from "@/pages/client/home/Librarysection";
import Hero from "./Hero";
import { useAppSelector } from "@/store/hooks";

const FeaturedAlbums = lazy(() => import("./FeaturedAlbums"));
const FeaturedPlaylists = lazy(() => import("./FeaturedPlaylists"));
const ArtistSpotlight = lazy(() => import("./ArtistSpotlight"));
const FeaturedGenres = lazy(() => import("./FeaturedGenres"));
const TopFeaturedTracks = lazy(() => import("./TopFeaturedTracks"));

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
    const {user} = useAppSelector((state) => state.auth); // Ensure we have user data before showing library
  
  return (
    <>
      <Hero />
      {user && <RecentlyListenedTrack />}
      {user && <LibrarySection />}
      {user && <MyPlaylist />}

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
