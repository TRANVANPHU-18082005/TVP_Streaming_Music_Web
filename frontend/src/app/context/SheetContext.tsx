import { memo, lazy, Suspense } from "react";

import type { AddToPlaylistSheetProps } from "./sheets/AddToPlaylistSheet";
import { TrackSheetProps } from "./sheets/TrackSheet";
import { AlbumSheetProps } from "./sheets/AlbumSheet";
import { GenreSheetProps } from "./sheets/GenreSheet";
import { ArtistSheetProps } from "./sheets/ArtistSheet";
import { PlaylistSheetProps } from "./sheets/PlaylistSheet";

// Sheet primitives (springs, variants and small UI primitives) moved to ./sheetPrimitives

// Thêm Track vào Album
const AlbumSheetLazy = lazy(() =>
  import("./sheets/AlbumSheet").then((m) => ({
    default: m.AlbumSheet,
  })),
);
export const AlbumSheet = memo((props: AlbumSheetProps) => (
  <Suspense fallback={null}>
    <AlbumSheetLazy {...props} />
  </Suspense>
));
AlbumSheet.displayName = "AlbumSheet";

// Thêm Track vào Playlist
const PlaylistSheetLazy = lazy(() =>
  import("./sheets/PlaylistSheet").then((m) => ({
    default: m.PlaylistSheet,
  })),
);
export const PlaylistSheet = memo((props: PlaylistSheetProps) => (
  <Suspense fallback={null}>
    <PlaylistSheetLazy {...props} />
  </Suspense>
));
PlaylistSheet.displayName = "PlaylistSheet";

// Thêm Track vào Artist
const ArtistSheetLazy = lazy(() =>
  import("./sheets/ArtistSheet").then((m) => ({
    default: m.ArtistSheet,
  })),
);
export const ArtistSheet = memo((props: ArtistSheetProps) => (
  <Suspense fallback={null}>
    <ArtistSheetLazy {...props} />
  </Suspense>
));
ArtistSheet.displayName = "ArtistSheet";

// Thêm Track vào Genre
const GenreSheetLazy = lazy(() =>
  import("./sheets/GenreSheet").then((m) => ({
    default: m.GenreSheet,
  })),
);
export const GenreSheet = memo((props: GenreSheetProps) => (
  <Suspense fallback={null}>
    <GenreSheetLazy {...props} />
  </Suspense>
));
GenreSheet.displayName = "GenreSheet";

// Thêm Track vào Playlist
const AddToPlaylistSheetLazy = lazy(() =>
  import("./sheets/AddToPlaylistSheet").then((m) => ({
    default: m.AddToPlaylistSheet,
  })),
);
export const AddToPlaylistSheet = memo((props: AddToPlaylistSheetProps) => (
  <Suspense fallback={null}>
    <AddToPlaylistSheetLazy {...props} />
  </Suspense>
));
AddToPlaylistSheet.displayName = "AddToPlaylistSheet";

// Track Sheet
const TrackSheetLazy = lazy(() =>
  import("./sheets/TrackSheet").then((m) => ({
    default: m.TrackSheet,
  })),
);
export const TrackSheet = memo((props: TrackSheetProps) => (
  <Suspense fallback={null}>
    <TrackSheetLazy {...props} />
  </Suspense>
));
TrackSheet.displayName = "TrackSheet";

// ─────────────────────────────────────────────────────────────────────────────
// SHEET PRIMITIVES — defined locally to avoid circular deps with Playersheets
// ─────────────────────────────────────────────────────────────────────────────

const QueueSheetLazy = lazy(() =>
  import("./sheets/QueueSheet").then((m) => ({ default: m.QueueSheet })),
);

export interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueSheet = memo((props: QueueSheetProps) => (
  <Suspense fallback={null}>
    <QueueSheetLazy {...props} />
  </Suspense>
));
QueueSheet.displayName = "QueueSheet";
