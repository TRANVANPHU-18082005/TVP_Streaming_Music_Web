import { memo } from "react";
import { motion } from "framer-motion";

import { IPlaylist } from "@/features/playlist";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { cn } from "@/lib/utils";
import {
  cardVariants,
  containerVariants,
  mobileCardVariants,
} from "../types/index";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST TAB
// ─────────────────────────────────────────────────────────────────────────────

export const PlaylistTab = memo(({ playlists }: { playlists: IPlaylist[] }) => {
  return (
    <div className="relative">
      {/* Mobile: horizontal scroll */}
      <div className="lg:hidden scroll-overflow-mask -mx-4 px-4" role="list">
        <HorizontalScroll>
          {playlists.map((pl, i) => (
            <motion.div
              key={pl._id}
              custom={i}
              variants={mobileCardVariants}
              initial="hidden"
              animate="visible"
              role="listitem"
              className={cn(
                "snap-start shrink-0 w-[168px] sm:w-[200px] first:pl-0 last:pr-4",
              )}
            >
              <PublicPlaylistCard playlist={pl} />
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
        {playlists.map((pl) => (
          <motion.div key={pl._id} variants={cardVariants} role="listitem">
            <PublicPlaylistCard playlist={pl} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
});
PlaylistTab.displayName = "PlaylistTab";
export default PlaylistTab;
