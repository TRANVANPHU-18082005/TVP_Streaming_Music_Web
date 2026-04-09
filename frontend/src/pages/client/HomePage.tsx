import { Hero } from "../../components/Hero";
import { FeaturedAlbums } from "../../components/FeaturedAlbums";
import { ArtistSpotlight } from "@/components/ArtistSpotlight";
import { FeaturedPlaylists } from "@/components/FeaturedPlaylists";
import { FeaturedGenres } from "@/components/FeaturedGenres";
import TopFeaturedTracks from "@/components/TopFeaturedTracks";
import { RecentlyListenedTrack } from "@/components/RecentlyListenedTrack";
import MyPlaylist from "@/components/MyPlaylist";
import LibrarySection from "@/components/Librarysection";

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
