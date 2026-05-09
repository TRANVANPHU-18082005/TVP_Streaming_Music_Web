import { PlaylistEditFormValues } from "../schemas/playlist.schema";
import { IPlaylist } from "../types";

export const PLAYLIST_DEFAULT_VALUES: PlaylistEditFormValues = {
  title: "",
  description: "",
  visibility: "public",
  type: "playlist",
  themeColor: "#1db954",
  isSystem: false,
  tags: [],
  collaborators: [],
  coverImage: null,
  publishAt: undefined,
  userId: undefined,
};

export const mapEntityToForm = (
  playlist?: IPlaylist | null,
): PlaylistEditFormValues => {
  if (!playlist) return PLAYLIST_DEFAULT_VALUES;
  const parsePublishAt = (iso?: string | Date | null): Date | undefined => {
    if (!iso) return undefined;
    const date = typeof iso === "string" ? new Date(iso) : iso;
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  return {
    title: playlist.title,
    description: playlist.description || "",
    visibility: playlist.visibility || "public",
    type: playlist.type || "playlist",
    themeColor: playlist.themeColor || "#1db954",
    isSystem: playlist.isSystem || false,
    coverImage: playlist.coverImage || null,
    tags: playlist.tags || [],
    // Xử lý collaborator: Nếu là object populated -> lấy _id, nếu là string -> giữ nguyên
    collaborators:
      playlist.collaborators?.map((u: any) =>
        typeof u === "object" ? u._id : u,
      ) || [],
    publishAt: parsePublishAt((playlist as any).publishAt),
    userId:
      playlist.user &&
      (typeof playlist.user === "string"
        ? playlist.user
        : (playlist.user as any)?._id),
  };
};
