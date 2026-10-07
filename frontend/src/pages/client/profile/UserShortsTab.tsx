import { Link } from "react-router-dom";
import { QueryErrorResult } from "@/components/ui/QueryState";
import { Plus, TvMinimalPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMyShorts } from "@/features/shorts/hooks/useShorts";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

const statusLabel = (status?: string, published?: boolean) => {
  if (published || status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Bị từ chối";
  return "Chờ duyệt";
};

const UserShortsTab = () => {
  const { data, isLoading, isError, error, refetch } = useMyShorts();
  const shorts = data?.data?.data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải short...</p>;
  }

  if (isError) {
    return <QueryErrorResult error={error} onRetry={() => void refetch()} size="sm" />;
  }

  if (shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed rounded-2xl">
        <TvMinimalPlay className="w-8 h-8 mb-3 text-muted-foreground" />
        <h3 className="text-xl font-bold mb-2">Chưa có Short nào</h3>
        <p className="text-sm text-muted-foreground mb-6">Cắt một đoạn highlight và gửi admin duyệt.</p>
        <Link to="/shorts/create" className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 h-10 text-sm font-medium">
          <Plus className="w-4 h-4" /> Tạo Short
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Short của tôi</h3>
        <Link to="/shorts/create" className="text-sm text-primary">Tạo mới</Link>
      </div>
      <div className="grid gap-3">
        {shorts.map((short) => (
          <div key={short._id} className="flex items-center gap-3 rounded-xl border p-3">
            <ImageWithFallback src={short.track?.coverImage} className="w-14 h-14 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{short.title || short.track?.title}</p>
              <p className="text-xs text-muted-foreground truncate">{short.caption}</p>
              {short.moderationStatus === "rejected" && short.rejectionReason && (
                <p className="text-xs text-destructive mt-1">{short.rejectionReason}</p>
              )}
            </div>
            <Badge variant="secondary">{statusLabel(short.moderationStatus, short.isPublished)}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserShortsTab;
