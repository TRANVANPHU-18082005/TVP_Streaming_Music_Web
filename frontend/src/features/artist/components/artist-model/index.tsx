import React, { useEffect } from "react";
import { createPortal } from "react-dom";

// Components (Giữ nguyên cấu trúc component con của bạn)
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import ImageSection from "./ImageSection";
import InfoSection from "./InfoSection";
import SocialSection from "./SocialSection";
import SettingsSection from "./SettingsSection";
import GallerySection from "./GallerySection";

// Logic Hook Mới
import { useArtistForm } from "@/features/artist/hooks/useArtistForm";
import { IArtist } from "../../types";

interface ArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistToEdit?: IArtist | null;
  // Hook mới yêu cầu onSubmit nhận FormData
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

const ArtistModal: React.FC<ArtistModalProps> = ({
  isOpen,
  onClose,
  artistToEdit,
  onSubmit,
  isPending,
}) => {
  // 🔥 TÍCH HỢP HOOK MỚI

  const {
    form,
    handleSubmit,
    isSubmitting: isFormSubmitting,
  } = useArtistForm(
    artistToEdit
      ? {
          mode: "edit",
          artistToEdit,
          onSubmit,
        }
      : {
          mode: "create",
          onSubmit,
        },
  );
  // Scroll lock + scrollbar compensation + Escape handling
  const isBusy = isPending || isFormSubmitting;

  useEffect(() => {
    if (!isOpen) return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    document.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.removeEventListener("keydown", handler);
    };
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop: Tối hơn (black/80) để tăng độ tương phản với Modal */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* Modal Container */}
      <div className="relative z-[101] w-full max-w-4xl max-h-[95vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10">
        {/* HEADER Cố định */}
        <ModalHeader
          title={artistToEdit ? "Edit Artist Profile" : "Create New Artist"}
          onClose={() => {
            if (!isBusy) onClose();
          }}
        />

        {/* BODY Có thể cuộn - Nền xám nhẹ để làm nổi bật các Card nội dung */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/15">
          <form
            id="artist-form"
            // 🔥 UPDATE: Sử dụng handleSubmit từ hook mới (đã xử lý FormData)
            onSubmit={handleSubmit}
            className="flex flex-col pb-8"
          >
            {/* 1. Phần ảnh bìa và Avatar */}
            {/* Giữ nguyên nền trắng hoặc theo thiết kế của component này */}
            <div className="bg-background border-b border-border/60">
              <ImageSection form={form} initialData={artistToEdit} />
            </div>

            {/* 2. Các Section nội dung: Bọc trong Card để tách biệt */}
            <div className="px-4 md:px-8 mt-6 space-y-6">
              {/* Card: Thông tin chính */}
              <div className="bg-background border border-border rounded-xl p-5 md:p-6 shadow-sm">
                <InfoSection form={form} artistToEdit={artistToEdit} />
              </div>

              {/* Grid: Mạng xã hội & Cài đặt */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-background border border-border rounded-xl p-5 shadow-sm h-full">
                  <SocialSection form={form} />
                </div>
                <div className="bg-background border border-border rounded-xl p-5 shadow-sm h-full">
                  <SettingsSection form={form} />
                </div>
              </div>

              {/* Card: Gallery */}
              <div className="bg-background border border-border rounded-xl p-5 md:p-6 shadow-sm">
                <GallerySection form={form} />
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER Cố định */}
        <div className="border-t border-border bg-background z-20">
          <ModalFooter
            onClose={onClose}
            // Kết hợp trạng thái loading từ API và Hook Form
            isPending={isPending || isFormSubmitting}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ArtistModal;
