import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import { ITrack } from "@/features/track";

export const TrackInfo = ({
  track,
  layout = "full",
  className,
}: {
  track: ITrack;
  layout?: "mini" | "full";
  className?: string;
}) => {
  const [isLiked, setIsLiked] = useState(false);

  if (layout === "mini") {
    return (
      <div className={cn("flex items-center gap-3 overflow-hidden", className)}>
        <div className="relative size-10 lg:size-14 rounded-md overflow-hidden border border-white/10 shrink-0">
          <ImageWithFallback
            src={track.coverImage}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm truncate hover:underline cursor-pointer">
            {track.title}
          </h4>
          <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
            {track.artist?.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hidden sm:flex hover:text-red-500",
            isLiked && "text-red-500",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsLiked(!isLiked);
          }}
        >
          <Heart className={cn("size-5", isLiked && "fill-current")} />
        </Button>
      </div>
    );
  }
  return (
    <div className={cn("flex items-end justify-between w-full", className)}>
      <div className="flex flex-col gap-1 min-w-0 pr-4">
        <h2 className="text-2xl lg:text-3xl font-black leading-tight truncate">
          {track.title}
        </h2>
        <p className="text-lg lg:text-xl text-muted-foreground font-medium truncate hover:text-white transition-colors">
          {track.artist?.name}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "mb-1 text-muted-foreground hover:bg-white/10 rounded-full size-12 shrink-0",
          isLiked && "text-red-500",
        )}
        onClick={() => setIsLiked(!isLiked)}
      >
        <Heart className={cn("size-7 lg:size-8", isLiked && "fill-current")} />
      </Button>
    </div>
  );
};
export default TrackInfo;
