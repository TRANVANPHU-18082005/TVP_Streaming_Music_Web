import React, { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ListMusic, Play, Clock, CheckCircle2, XCircle, Trash2, Loader2, Music2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import Pagination from "@/utils/pagination";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRecordings } from "../hooks/useKaraokeQueries";
import { useSubmitForReview } from "../hooks/useKaraokeMutations";
import karaokeApi from "../api/karaokeApi";
import { karaokeKeys } from "../utils/karaokeKeys";
import { readApiError } from "../utils/mixSync";
import type { IKaraokeRecording } from "../types";
import { KaraokePlaybackModal } from "./KaraokePlaybackModal";

export const KaraokeMyRecordings = () => {
  const [page, setPage] = useState(1);
  const [playingRec, setPlayingRec] = useState<IKaraokeRecording | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const submitReview = useSubmitForReview();

  const { data, isLoading } = useMyRecordings({
    page,
    limit: 10,
    sort: "newest",
  });

  const handleSubmit = async (id: string) => {
    setSubmittingId(id);
    try {
      await submitReview.mutateAsync(id);
      toast.success("Đã gửi duyệt");
    } catch (err: unknown) {
      toast.error(readApiError(err, "Không gửi duyệt được"));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bản thu này?")) return;
    try {
      await karaokeApi.deleteRecording(id);
      toast.success("Đã xóa bản thu");
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myRecordings({ page, limit: 10, sort: "newest" }) });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myPermission() }); // Update quota
    } catch (err: unknown) {
      toast.error(readApiError(err, "Lỗi khi xóa"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Đang tải danh sách bản thu của bạn...</p>
      </div>
    );
  }

  const recordings = data?.data?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ListMusic className="w-5 h-5 md:w-6 md:h-6 text-primary" /> Bản thu của tôi
          </h2>
          <p className="text-muted-foreground mt-1 text-xs md:text-sm">
            Quản lý các bản thu âm bạn đã đăng tải và theo dõi trạng thái duyệt.
          </p>
        </div>
      </div>

      {!recordings.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white/40 dark:bg-card/20 backdrop-blur-3xl rounded-[2rem] shadow-sm border border-dashed border-border/50">
          <Music2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-bold text-lg text-foreground/80">Bạn chưa có bản thu nào.</p>
          <p className="text-sm mt-1">Hãy vào phòng thu và tạo bản thu đầu tiên nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {recordings.map((rec: IKaraokeRecording) => (
            <div key={rec._id} className="flex flex-col sm:flex-row gap-4 p-4 md:p-5 rounded-3xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-card/20 backdrop-blur-2xl shadow-sm hover:shadow-xl hover:bg-white/60 dark:hover:bg-card/40 transition-all duration-300">
              {/* Thumbnail */}
              <div 
                className="relative w-full sm:w-36 md:w-44 aspect-video rounded-2xl overflow-hidden shrink-0 group cursor-pointer bg-black/10 ring-1 ring-black/5 dark:ring-white/10"
                onClick={() => setPlayingRec(rec)}
              >
                <ImageWithFallback
                  src={rec.youtubeThumbnail || `https://img.youtube.com/vi/${rec.youtubeVideoId}/hqdefault.jpg`}
                  alt={rec.youtubeTitle}
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700"
                />
                <button
                  className="absolute inset-0 m-auto w-12 h-12 md:w-14 md:h-14 bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-xl shadow-primary/30 backdrop-blur-sm"
                >
                  <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" />
                </button>
              </div>

              {/* Info */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 md:gap-4">
                  <div>
                    <h3 className="font-bold text-base md:text-lg line-clamp-1 group-hover:text-primary transition-colors cursor-pointer" onClick={() => setPlayingRec(rec)} title={rec.title}>
                      {rec.title}
                    </h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 mt-0.5 md:mt-1" title={rec.youtubeTitle}>
                      {rec.youtubeTitle}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 h-8 w-8 md:h-10 md:w-10" onClick={() => handleDelete(rec._id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-auto pt-3 md:pt-4 text-[10px] md:text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3 md:w-4 md:h-4" />
                    {format(new Date(rec.createdAt), 'dd/MM/yyyy', { locale: vi })}
                  </div>

                  <StatusBadge status={rec.status} />
                  {rec.status === "uploaded" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 px-3 text-xs rounded-full font-bold shadow-sm"
                      disabled={submittingId === rec._id}
                      onClick={() => void handleSubmit(rec._id)}
                    >
                      {submittingId === rec._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Gửi duyệt
                    </Button>
                  )}

                  {rec.status === 'rejected' && rec.rejectionReason && (
                    <div className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded w-full line-clamp-2" title={rec.rejectionReason}>
                      Lý do: {rec.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {data?.data?.meta && data.data.meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination 
                currentPage={page} 
                totalPages={data.data.meta.totalPages} 
                onPageChange={setPage} 
                totalItems={data.data.meta.total || data.data.meta.totalItems || 0}
                pageSize={data.data.meta.limit || data.data.meta.pageSize || 10}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal Phát Nhạc */}
      {playingRec && (
        <KaraokePlaybackModal 
          recording={playingRec} 
          onClose={() => setPlayingRec(null)} 
        />
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "uploaded":
      return (
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" /> Bản nháp
        </span>
      );
    case "pending_review":
      return (
        <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-600">
          <Clock className="h-3 w-3" /> Chờ duyệt
        </span>
      );
    case 'approved':
      return (
        <span className="flex items-center gap-1 text-green-600 bg-green-500/10 px-2 py-1 rounded-full text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" /> Đã duyệt
        </span>
      );
    case 'rejected':
      return (
        <span className="flex items-center gap-1 text-red-600 bg-red-500/10 px-2 py-1 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" /> Từ chối
        </span>
      );
    default:
      return null;
  }
};
