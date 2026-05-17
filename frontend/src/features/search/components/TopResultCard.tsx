import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { fadeUp, SPRING_MEDIUM, TopResultItem } from "@/features/search";
import { ITrack } from "@/features/track";

interface Props {
  item: TopResultItem;
  isCurrentPlaying: boolean;
  isLoadingThis: boolean;
  onPlay: (e: React.MouseEvent, track: ITrack) => void;
}

const TopResultCard = React.memo(
  ({ item, isCurrentPlaying, isLoadingThis, onPlay }: Props) => {
    const type = item.type;
    const navigate = useNavigate();

    const onNavigate = () => {
      if (type === "album") navigate(`/albums/${item.slug}`);
      if (type === "artist") navigate(`/artists/${item.slug}`);
      if (type === "playlist") navigate(`/playlists/${item._id}`);
      if (type === "track") navigate(`/tracks/${item._id}`);
      if (type === "genre") navigate(`/genres/${item.slug}`);
    };

    const displayName =
      type !== "artist" && type !== "genre" ? item.title : item.name;

    const imgSrc =
      type === "artist"
        ? item.avatar
        : type === "genre"
          ? item.image
          : item.coverImage;

    return (
      <motion.div
        variants={fadeUp}
        custom={0}
        className="h-full flex flex-col gap-3.5"
      >
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
          Kết quả hàng đầu
        </h2>

        <motion.div
          onClick={onNavigate}
          whileHover={{ scale: 1.012 }}
          transition={SPRING_MEDIUM}
          className={cn(
            "group relative flex-1 flex flex-col justify-end p-6 rounded-2xl overflow-hidden cursor-pointer",
            "dark:bg-white/[0.04] bg-black/[0.03]",
            "border dark:border-white/[0.06] border-black/[0.06]",
            "dark:hover:border-primary/30 hover:border-primary/25",
            "transition-colors duration-300 min-h-[220px]",
            "shadow-sm hover:shadow-lg",
          )}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

          {/* Thumbnail */}
          <div
            className={cn(
              "absolute top-6 left-6 shadow-xl transition-transform duration-500 group-hover:scale-[1.04]",
              type === "artist" || type === "genre"
                ? "size-24 rounded-full border-2 dark:border-white/10 border-black/10"
                : "size-24 rounded-xl",
              "overflow-hidden",
            )}
          >
            <ImageWithFallback
              src={imgSrc}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="relative z-10 mt-28 flex flex-col gap-2">
            <h3
              className="text-2xl font-black tracking-tight dark:text-white text-gray-900 line-clamp-2 group-hover:text-primary transition-colors"
              dangerouslySetInnerHTML={{
                __html: item.highlightHtml || displayName,
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full dark:bg-white/8 bg-black/6 dark:text-white/55 text-gray-600">
                {type === "artist"
                  ? "Nghệ sĩ"
                  : type === "album"
                    ? "Album"
                    : type === "playlist"
                      ? "Playlist"
                      : type === "genre"
                        ? "Thể loại"
                        : "Bài hát"}
              </span>
              {type !== "artist" &&
                type !== "genre" &&
                type !== "playlist" &&
                item.artist?.name && (
                  <span className="text-sm dark:text-white/45 text-gray-500 truncate">
                    {item.artist.name}
                  </span>
                )}
            </div>
          </div>

          {/* Play button — only for tracks */}
          {type === "track" && (
            <motion.button
              onClick={(e) => onPlay(e, item as ITrack)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING_MEDIUM}
              disabled={isLoadingThis}
              className={cn(
                "absolute bottom-5 right-5 z-10",
                "flex items-center justify-center size-13 rounded-full",
                "bg-primary text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
                "group-hover:opacity-100 translate-y-2 group-hover:translate-y-0",
                "transition-all duration-250",
                isCurrentPlaying && "opacity-100 translate-y-0",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoadingThis ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : isCurrentPlaying ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 fill-current ml-0.5" />
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    );
  },
);

TopResultCard.displayName = "TopResultCard";
export default TopResultCard;
