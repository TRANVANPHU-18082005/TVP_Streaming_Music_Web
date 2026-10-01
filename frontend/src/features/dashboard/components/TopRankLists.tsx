import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { ADMIN_PATHS } from "@/config/paths";
import { formatNumber } from "@/utils/format";
import type { TopArtist, TopTrack } from "../types";

const songsPath = `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.SONGS}`;
const artistsPath = `${ADMIN_PATHS.ADMIN}/${ADMIN_PATHS.ARTISTS}`;

function EmptyList() {
  return <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>;
}

export function TopRankLists({
  topTracks,
  topArtists,
}: {
  topTracks: TopTrack[];
  topArtists: TopArtist[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Bài nghe nhiều</h2>
        <p className="mb-4 text-sm text-muted-foreground">Theo tổng lượt nghe</p>
        {topTracks.length === 0 ? (
          <EmptyList />
        ) : (
          <ol className="space-y-2">
            {topTracks.map((track, index) => (
              <li key={track._id}>
                <Link
                  to={songsPath}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
                >
                  <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <ImageWithFallback
                    src={track.coverImage}
                    alt=""
                    className="size-10 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{track.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {track.artist?.name ?? "Không rõ"}
                    </span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatNumber(track.playCount)} lượt
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Nghệ sĩ nghe nhiều</h2>
        <p className="mb-4 text-sm text-muted-foreground">Theo tổng lượt nghe</p>
        {topArtists.length === 0 ? (
          <EmptyList />
        ) : (
          <ol className="space-y-2">
            {topArtists.map((artist, index) => (
              <li key={artist._id}>
                <Link
                  to={artistsPath}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
                >
                  <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <ImageWithFallback
                    src={artist.avatar}
                    alt=""
                    className="size-10 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {artist.name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatNumber(artist.playCount)} lượt
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
