import { IArtist } from "@/features";
import { ArtistEditFormValues } from "../schemas/artist.schema";

export const ARTIST_DEFAULT_VALUES: ArtistEditFormValues = {
  name: "",
  aliases: [],
  nationality: "VN",
  userId: undefined,
  bio: undefined,
  themeColor: "#ffffff",
  isVerified: false,
  // ── FLAT SOCIAL LINKS (match schema) ──
  facebook: undefined,
  instagram: undefined,
  twitter: undefined,
  website: undefined,
  spotify: undefined,
  youtube: undefined,
  // ── MEDIA ──
  avatar: undefined,
  coverImage: undefined,
  images: [],
};

export const mapEntityToForm = (
  artist?: IArtist | null,
): ArtistEditFormValues => {
  if (!artist) return ARTIST_DEFAULT_VALUES;

  return {
    ...ARTIST_DEFAULT_VALUES, // Fallback
    name: artist.name,
    aliases: artist.aliases || [],
    nationality: artist.nationality || "VN",
    // Nếu API trả về object user -> lấy _id
    userId: typeof artist.user === "object" ? artist.user?._id : artist.user,
    bio: artist.bio,
    themeColor: artist.themeColor || "#ffffff",
    isVerified: artist.isVerified || false,
    // ── FLAT SOCIAL LINKS (match schema) ──
    facebook: artist.socialLinks?.facebook,
    instagram: artist.socialLinks?.instagram,
    twitter: artist.socialLinks?.twitter,
    website: artist.socialLinks?.website,
    spotify: artist.socialLinks?.spotify,
    youtube: artist.socialLinks?.youtube,
    // ── MEDIA ──
    avatar: artist.avatar || undefined,
    coverImage: artist.coverImage || undefined,
    images: artist.images || [],
  };
};
