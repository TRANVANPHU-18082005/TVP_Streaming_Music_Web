import { type AlbumFormValues } from "../schemas/album.schema";
import { IAlbum } from "../types";

// 1. Định nghĩa giá trị mặc định chuẩn xác
export const ALBUM_DEFAULT_VALUES: AlbumFormValues = {
  title: "",
  type: "album",
  description: "",
  releaseDate: new Date().toISOString().split("T")[0],
  isPublic: false,
  artist: "",

  tags: [],
  coverImage: null,

  themeColor: "#1db954",
};

export const mapEntityToForm = (album?: IAlbum | null): AlbumFormValues => {
  if (!album) return ALBUM_DEFAULT_VALUES;

  const artistId =
    typeof album.artist === "object" && album.artist
      ? (album.artist as any)._id
      : (album.artist as any) || "";

  let formattedDate = new Date().toISOString().split("T")[0];
  if (album.releaseDate) {
    try {
      formattedDate = new Date(album.releaseDate).toISOString().split("T")[0];
    } catch {
      /* ignore */
    }
  }

  return {
    ...ALBUM_DEFAULT_VALUES,
    title: album.title,
    type: album.type || "album",
    description: album.description || "",
    releaseDate: formattedDate,
    isPublic: album.isPublic,
    artist: artistId,
    tags: Array.isArray(album.tags) ? album.tags : [],
    coverImage: album.coverImage,

    themeColor: album.themeColor || "#1db954",
  };
};
