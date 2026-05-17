// ─────────────────────────────────────────────────────────────────────────────
// BUILD TRACK LIST PROPS
// ─────────────────────────────────────────────────────────────────────────────

import { TrackTabPanelProps } from "../components/TrackTabPanel";

export function buildTrackListProps({
  tracks,
  totalItems,
  isLoading,
  error,
  refetch,
}: Pick<
  TrackTabPanelProps,
  "tracks" | "totalItems" | "isLoading" | "error" | "refetch"
>) {
  return {
    allTrackIds: tracks.map((t) => t._id),
    tracks,
    totalItems,
    isLoading,
    error,
    isFetchingNextPage: false,
    hasNextPage: false,
    onFetchNextPage: () => {},
    onRetry: refetch,
  };
}
