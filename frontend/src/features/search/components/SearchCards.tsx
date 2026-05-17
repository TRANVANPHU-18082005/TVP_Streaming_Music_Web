import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import {
  fadeUp,
  SearchAlbum,
  SearchArtist,
  SearchGenre,
  SearchPlaylist,
  SPRING_MEDIUM,
} from "@/features/search";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  showMore?: boolean;
  onMore?: () => void;
}

export const SectionHeader = ({
  title,
  showMore,
  onMore,
}: SectionHeaderProps) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
      {title}
    </h2>
    {showMore && (
      <motion.button
        onClick={onMore}
        whileHover={{ x: 2 }}
        transition={SPRING_MEDIUM}
        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] dark:text-white/40 text-gray-500 hover:text-primary transition-colors"
      >
        Xem tất cả <ArrowUpRight className="size-3.5" />
      </motion.button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST CARD
// ─────────────────────────────────────────────────────────────────────────────

interface SearchArtistCardProps {
  artist: SearchArtist;
  onClick: (e: React.MouseEvent) => void;
}

export const SearchArtistCard = React.memo(
  ({ artist, onClick }: SearchArtistCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-full overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={artist.avatar}
          alt={artist.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-center text-center">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: artist.highlightHtml || artist.name,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5">
          Nghệ sĩ
        </p>
      </div>
    </motion.div>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CARD
// ─────────────────────────────────────────────────────────────────────────────

interface SearchAlbumCardProps {
  album: SearchAlbum;
  onClick: (e: React.MouseEvent) => void;
}

export const SearchAlbumCard = React.memo(
  ({ album, onClick }: SearchAlbumCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={album.coverImage}
          alt={album.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: album.highlightHtml || album.title,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5 truncate">
          {album.artist?.name || "Đĩa nhạc"}
        </p>
      </div>
    </motion.div>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST CARD
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPlaylistCardProps {
  playlist: SearchPlaylist;
  onClick: (e: React.MouseEvent) => void;
}

export const SearchPlaylistCard = React.memo(
  ({ playlist, onClick }: SearchPlaylistCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={playlist.coverImage}
          alt={playlist.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: playlist.highlightHtml || playlist.title,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5 truncate">
          Danh sách phát
        </p>
      </div>
    </motion.div>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// GENRE CARD
// ─────────────────────────────────────────────────────────────────────────────

interface SearchGenreCardProps {
  genre: SearchGenre;
  onClick: (e: React.MouseEvent) => void;
}

export const SearchGenreCard = React.memo(
  ({ genre, onClick }: SearchGenreCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_MEDIUM}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
      style={{ backgroundColor: genre.color || "#6366f1" }}
    >
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
      <h3
        className="absolute top-4 left-4 text-white text-lg font-black tracking-tight"
        dangerouslySetInnerHTML={{ __html: genre.highlightHtml || genre.name }}
      />
      <ImageWithFallback
        src={genre.image}
        alt={genre.name}
        className="absolute -bottom-2 -right-4 w-24 h-24 object-cover rounded shadow-xl rotate-[25deg] transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110"
      />
    </motion.div>
  ),
);
