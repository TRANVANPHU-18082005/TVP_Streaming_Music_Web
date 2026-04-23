// components/track/ArtistDisplay.tsx
import { Link } from "react-router-dom";
import { IArtist } from "@/features/artist/types";

interface Props {
  primary: IArtist;
  featuring?: IArtist[];
  className?: string;
}

export const ArtistDisplay = ({
  primary,
  featuring = [],
  className = "",
}: Props) => {
  // Chỉ lấy những nghệ sĩ featuring không trùng với primary
  const allArtists = [
    primary,
    ...featuring.filter((f) => f._id !== primary._id),
  ];

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {allArtists.map((artist, index) => (
        <span key={artist._id} className="inline-block">
          <Link
            to={`/artist/${artist.slug}`}
            className="hover:text-white hover:underline transition-colors duration-200"
          >
            {artist.name}
          </Link>
          {index < allArtists.length - 1 && (
            <span className="text-white/40 ml-0.5">, </span>
          )}
        </span>
      ))}
    </div>
  );
};
