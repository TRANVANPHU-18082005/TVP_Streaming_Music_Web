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
  // Convert ISO datetime to input[type="datetime-local"] string (YYYY-MM-DDTHH:mm)
  const isoToLocalDateTime = (iso?: string | null) => {
    if (!iso) return undefined;
    try {
      const d = new Date(iso);
      // Create a local datetime string without timezone offset
      const tzOffsetMs = d.getTimezoneOffset() * 60000;
      const local = new Date(d.getTime() - tzOffsetMs);
      return local.toISOString().slice(0, 16);
    } catch {
      return undefined;
    }
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
    publishAt: isoToLocalDateTime((playlist as any).publishAt),
    userId:
      playlist.user &&
      (typeof playlist.user === "string"
        ? playlist.user
        : (playlist.user as any)?._id),
  };
};
