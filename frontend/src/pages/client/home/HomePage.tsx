import { ArtistSpotlight } from "@/pages/client/home/ArtistSpotlight";
import { FeaturedPlaylists } from "@/pages/client/home/FeaturedPlaylists";
import { FeaturedGenres } from "@/pages/client/home/FeaturedGenres";
import TopFeaturedTracks from "@/pages/client/home/TopFeaturedTracks";
import { RecentlyListenedTrack } from "@/pages/client/home/RecentlyListenedTrack";
import MyPlaylist from "@/pages/client/home/MyPlaylist";
import LibrarySection from "@/pages/client/home/Librarysection";
import Hero from "./Hero";
import FeaturedAlbums from "./FeaturedAlbums";

export function HomePage() {
  return (
    <>
      <Hero />
      <RecentlyListenedTrack />
      <LibrarySection />
      <MyPlaylist />
      <FeaturedAlbums />
      <FeaturedPlaylists />
      <ArtistSpotlight />
      <FeaturedGenres />
      <TopFeaturedTracks />
    </>
  );
}
export default HomePage;
