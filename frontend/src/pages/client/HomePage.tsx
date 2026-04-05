import { Hero } from "../../components/Hero";
import { FeaturedAlbums } from "../../components/FeaturedAlbums";
import { ArtistSpotlight } from "@/components/ArtistSpotlight";
import { FeaturedPlaylists } from "@/components/FeaturedPlaylists";
import { FeaturedGenres } from "@/components/FeaturedGenres";
import TopFeaturedTracks from "@/components/TopFeaturedTracks";
import { RecentlyListenedTrack } from "@/components/RecentlyListenedTrack";
import FavouriteAlbum from "@/components/FavouriteAlbum";
import FavouritePlaylist from "@/components/FavouritePlaylist";
import MyPlaylist from "@/components/MyPlaylist";
import FavouriteTrack from "@/components/FavouriteTrack";
import LibrarySection from "@/components/Librarysection";

export function HomePage() {
  return (
    <>
      <Hero />
      <RecentlyListenedTrack />
      <LibrarySection />
      {/* <FavouriteTrack />
      <FavouriteAlbum />
      <FavouritePlaylist /> */}
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
