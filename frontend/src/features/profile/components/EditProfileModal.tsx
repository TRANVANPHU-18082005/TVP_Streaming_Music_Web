// Components/Profile/EditProfileModal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProfileForm } from "@/features/profile/hooks/useProfileForm";
import { useProfileMutations } from "@/features/profile/hooks/useProfileMutations";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function EditProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { updateProfile, isUpdating } = useProfileMutations();

  const { form, handleSubmit } = useProfileForm(async (formData) => {
    updateProfile(formData, {
      onSuccess: () => onOpenChange(false),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0e14] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black italic">
            SỬA HỒ SƠ
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-white/40">
              Tên hiển thị
            </Label>
            <Input
              {...form.register("name")}
              className="bg-white/5 border-white/10 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-white/40">
              Tiểu sử
            </Label>
            <Textarea
              {...form.register("bio")}
              className="bg-white/5 border-white/10 min-h-[100px]"
              placeholder="Kể về gu âm nhạc của bạn..."
            />
          </div>
          <Button
            type="submit"
            disabled={isUpdating}
            className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
          >
            {isUpdating ? <Loader2 className="animate-spin" /> : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
