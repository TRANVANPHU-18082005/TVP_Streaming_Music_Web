import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

// Components/Profile/CreatePlaylistModal.tsx
export function CreatePlaylistModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Giả sử Phú đã có hook usePlaylistMutations tương tự Album
  // const { createPlaylist } = usePlaylistMutations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0e14] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            TẠO PLAYLIST MỚI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="aspect-square w-40 mx-auto rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 group cursor-pointer hover:bg-white/10 transition-all">
            <Plus className="size-8 text-white/20 group-hover:text-blue-500" />
            <span className="text-[10px] font-bold text-white/20">
              TẢI ẢNH BÌA
            </span>
          </div>
          <Input
            placeholder="Tên danh sách phát"
            className="bg-white/5 border-white/10"
          />
          <Button className="w-full bg-white text-black font-bold">
            TẠO NGAY
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
