/**
 * UserPlaylistModal.tsx — Optimized for "Quick Create" Flow
 * SOUNDWAVE Design System · User Experience Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Optimized for API: POST /playlists/me
 */

import { useEffect, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Loader2,
  Globe,
  Lock,
  CheckCircle2,
  Type,
  Sparkles,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_CLASS =
  "text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 flex items-center gap-2 w-fit";
const MODAL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

const VISIBILITY_OPTIONS = [
  {
    id: "public",
    label: "Công khai",
    desc: "Mọi người đều nghe được",
    icon: Globe,
    activeColor: "text-emerald-400",
    activeBg: "bg-emerald-500/10",
    activeBorder: "border-emerald-500/40",
    dotColor: "bg-emerald-400",
  },
  {
    id: "private",
    label: "Riêng tư",
    desc: "Chỉ mình bạn xem được",
    icon: Lock,
    activeColor: "text-rose-400",
    activeBg: "bg-rose-500/10",
    activeBorder: "border-rose-500/40",
    dotColor: "bg-rose-400",
  },
] as const;

interface UserPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title?: string; visibility?: string }) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const UserPlaylistModal = memo<UserPlaylistModalProps>(
  ({ isOpen, onClose, onSubmit, isPending }) => {
    const {
      register,
      handleSubmit,
      watch,
      setValue,
      reset,
      formState: { errors, isSubmitting },
    } = useForm({
      defaultValues: {
        title: "",
        visibility: "public",
        description: "",
      },
    });

    const isWorking = useMemo(
      () => isPending || isSubmitting,
      [isPending, isSubmitting],
    );
    const currentVisibility = watch("visibility");

    // Reset form when opening/closing
    useEffect(() => {
      if (!isOpen) reset();
    }, [isOpen, reset]);

    // Handle ESC key
    useEffect(() => {
      if (!isOpen) return;
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isWorking) onClose();
      };
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, isWorking, onClose]);

    const onInternalSubmit = async (data: any) => {
      await onSubmit({
        title: data.title || undefined, // Backend sẽ tự đặt tên nếu rỗng
        visibility: data.visibility,
      });
      onClose();
    };

    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl"
              onClick={!isWorking ? onClose : undefined}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="relative z-[151] w-full max-w-lg bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">
                      Tạo nhanh Playlist
                    </h3>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                      Khởi đầu giai điệu của riêng bạn
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={isWorking}
                  className="size-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                  <X className="size-5 text-white/40" />
                </button>
              </div>

              {/* Form Body */}
              <form
                onSubmit={handleSubmit(onInternalSubmit)}
                className="p-8 space-y-8"
              >
                <div className="space-y-6">
                  {/* Title Input */}
                  <div className="space-y-2">
                    <Label className={LABEL_CLASS}>
                      <Type className="size-3" /> Tên danh sách phát
                    </Label>
                    <Input
                      {...register("title")}
                      placeholder="Để trống để tạo tự động..."
                      className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:border-blue-500/50 transition-all text-lg font-bold placeholder:text-white/10"
                    />
                  </div>

                  {/* Visibility Toggle */}
                  <div className="space-y-4">
                    <Label className={LABEL_CLASS}>
                      <Globe className="size-3" /> Chế độ hiển thị
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      {VISIBILITY_OPTIONS.map((opt) => {
                        const isSelected = currentVisibility === opt.id;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setValue("visibility", opt.id)}
                            className={cn(
                              "relative p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-3 text-left group",
                              isSelected
                                ? cn(
                                    "shadow-xl ring-1 ring-white/10",
                                    opt.activeBg,
                                    opt.activeBorder,
                                  )
                                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <Icon
                                className={cn(
                                  "size-5 transition-colors",
                                  isSelected
                                    ? opt.activeColor
                                    : "text-muted-foreground",
                                )}
                              />
                              <div
                                className={cn(
                                  "size-4 rounded-full border-2 flex items-center justify-center transition-all",
                                  isSelected
                                    ? cn(
                                        "scale-110 border-transparent shadow-[0_0_10px_rgba(255,255,255,0.2)]",
                                        opt.dotColor,
                                      )
                                    : "border-white/10",
                                )}
                              >
                                {isSelected && (
                                  <CheckCircle2 className="size-2.5 text-black stroke-[4px]" />
                                )}
                              </div>
                            </div>
                            <div>
                              <p
                                className={cn(
                                  "text-xs font-black uppercase tracking-widest",
                                  isSelected
                                    ? "text-white"
                                    : "text-muted-foreground",
                                )}
                              >
                                {opt.label}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isWorking}
                    className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white/40 hover:bg-white/5 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isWorking}
                    className="flex-[2] h-14 bg-white text-black hover:bg-blue-500 hover:text-white font-black rounded-2xl shadow-xl transition-all duration-500 uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    {isWorking ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Xác nhận tạo ngay
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);

UserPlaylistModal.displayName = "UserPlaylistModal";
export default UserPlaylistModal;
