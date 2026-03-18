import {
  Mic2,
  ListMusic,
  Share2,
  MoreHorizontal,
  CircleStop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stopPlaying } from "@/features/player/slice/playerSlice";
import { useAppDispatch } from "@/store/hooks";

export const ExtraControls = ({
  onQueueClick,
  isQueueActive,
}: {
  onQueueClick?: () => void;
  isQueueActive?: boolean;
}) => {
  const dispatch = useAppDispatch();
  return (
    <div className="flex items-center justify-between gap-4 w-full lg:w-auto">
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:text-primary hover:bg-secondary"
        title="Lyrics"
      >
        <Mic2 className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "transition-colors",
          isQueueActive
            ? "text-primary bg-primary/10"
            : "text-white hover:text-primary hover:bg-secondary",
        )}
        title="Queue"
        onClick={onQueueClick}
      >
        <ListMusic className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:text-primary hover:bg-secondary"
        title="Share"
      >
        <Share2 className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => dispatch(stopPlaying())}
        className="text-white hover:text-primary hover:bg-secondary"
        title="Share"
      >
        <CircleStop className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:text-primary hover:bg-secondary"
        title="More"
      >
        <MoreHorizontal className="size-5" />
      </Button>
    </div>
  );
};
export default ExtraControls;
