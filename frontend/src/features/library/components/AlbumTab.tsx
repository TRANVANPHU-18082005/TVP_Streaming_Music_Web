import { memo } from "react";
import { motion } from "framer-motion";

import { IAlbum } from "@/features/album";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { cn } from "@/lib/utils";
import {
  cardVariants,
  containerVariants,
  mobileCardVariants,
} from "../types/index";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM TAB
// ─────────────────────────────────────────────────────────────────────────────

export const AlbumTab = memo(({ albums }: { albums: IAlbum[] }) => {
  return (
    <div className="relative">
      {/* Mobile: horizontal scroll */}
      <div className="lg:hidden scroll-overflow-mask -mx-4 px-4" role="list">
        <HorizontalScroll>
          {albums.map((album, i) => (
            <motion.div
              key={album._id}
              custom={i}
              variants={mobileCardVariants}
              initial="hidden"
              animate="visible"
              role="listitem"
              className={cn(
                "snap-start shrink-0 w-[168px] sm:w-[200px] first:pl-0 last:pr-4",
              )}
            >
              <PublicAlbumCard album={album} />
            </motion.div>
          ))}
        </HorizontalScroll>
      </div>

      {/* Desktop: grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-48px" }}
        className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
        role="list"
      >
        {albums.map((album) => (
          <motion.div key={album._id} variants={cardVariants} role="listitem">
            <PublicAlbumCard album={album} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
});
AlbumTab.displayName = "AlbumTab";
export default AlbumTab;
