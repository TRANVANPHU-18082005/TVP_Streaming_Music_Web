import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setVolume,
  toggleMute,
} from "@/features/player/slice/playerSlice";

export const VolumeControl = ({ className }: { className?: string }) => {
  const dispatch = useDispatch();
  const { volume, isMuted } = useSelector(selectPlayer);
  const handleVolumeChange = useCallback(
    (val: number[]) => dispatch(setVolume(val[0] / 100)),
    [dispatch],
  );
  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={cn("flex items-center gap-2 group/volume", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => dispatch(toggleMute())}
        className="text-primary hover:text-primary hover:bg-accent h-8 w-8"
      >
        <VolumeIcon className="size-5" />
      </Button>
      <div className="w-20 lg:w-28 transition-all opacity-80 group-hover/volume:opacity-100">
        <Slider
          value={[isMuted ? 0 : volume * 100]}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
};
export default VolumeControl;
