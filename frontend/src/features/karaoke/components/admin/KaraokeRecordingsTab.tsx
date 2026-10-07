import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle, XCircle, Search, Clock, MessageSquareText, PlayCircle } from "lucide-react";
import { KaraokePlaybackModal } from "../KaraokePlaybackModal";
import { useAdminRecordings } from "../../hooks/useKaraokeQueries";
import { useAdminReviewRecording } from "../../hooks/useKaraokeMutations";
import { IKaraokeRecording } from "../../types";
import { QueryErrorResult } from "@/components/ui/QueryState";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Pagination from "@/utils/pagination";

const STATUS_MAP = {
  uploaded: { label: "Đã Upload", color: "bg-gray-500" },
  pending_review: { label: "Chờ duyệt", color: "bg-yellow-500" },
  approved: { label: "Đã duyệt", color: "bg-green-500" },
  rejected: { label: "Từ chối", color: "bg-red-500" },
};

const KaraokeRecordingsTab = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [playingRec, setPlayingRec] = useState<IKaraokeRecording | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminRecordings({
    page,
    limit: 10,
    status: status !== "all" ? (status as IKaraokeRecording["status"]) : undefined,
    keyword: keyword || undefined,
  });

  const { mutate: reviewRecording, isPending: isReviewing } = useAdminReviewRecording();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput);
    setPage(1);
  };

  const handleReview = (id: string, action: "approve" | "reject") => {
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("Lý do từ chối (bắt buộc):") || "";
      if (!reason.trim()) return; // Must have reason
    }
    
    if (window.confirm(`Xác nhận ${action === "approve" ? "duyệt" : "từ chối"} bản thu này?`)) {
      reviewRecording({
        id,
        payload: { action, rejectionReason: reason },
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between gap-4 rounded-md bg-muted/30 p-3">
        <form onSubmit={handleSearch} className="flex flex-1 max-w-sm gap-2">
          <Input
            placeholder="Tìm kiếm title, email, username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-background"
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Lọc trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending_review">Chờ duyệt</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="rejected">Bị từ chối</SelectItem>
              <SelectItem value="uploaded">Bản nháp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Bản Thu</TableHead>
              <TableHead>Thời lượng / Kích thước</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày gửi</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  Đang tải dữ liệu...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="p-6">
                  <QueryErrorResult error={error} onRetry={() => void refetch()} size="sm" />
                </TableCell>
              </TableRow>
            ) : !data?.data?.data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  Không tìm thấy bản thu nào.
                </TableCell>
              </TableRow>
            ) : (
              data.data.data.map((record: IKaraokeRecording) => (
                <TableRow key={record._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={record.user.avatar} />
                        <AvatarFallback>{record.user.username.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{record.user.fullName}</span>
                        <span className="text-xs text-muted-foreground">@{record.user.username}</span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-col max-w-[200px]">
                      <span className="font-medium truncate" title={record.title}>{record.title}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        YouTube: {record.youtubeTitle}
                      </span>
                      {record.audioUrl && record.youtubeVideoId && (
                        <button
                          type="button"
                          onClick={() => setPlayingRec(record)}
                          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <PlayCircle className="h-3 w-3" /> Nghe mix
                        </button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {formatDuration(record.audioDuration)}</span>
                      <span>{(record.audioSize / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className={`${STATUS_MAP[record.status].color} text-white hover:${STATUS_MAP[record.status].color}`}>
                      {STATUS_MAP[record.status].label}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(record.createdAt), "dd/MM/yyyy HH:mm")}
                  </TableCell>

                  <TableCell className="text-right">
                    {record.status === "pending_review" && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white"
                          disabled={isReviewing}
                          onClick={() => handleReview(record._id, "approve")}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" /> Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
                          disabled={isReviewing}
                          onClick={() => handleReview(record._id, "reject")}
                        >
                          <XCircle className="mr-1 h-3 w-3" /> Từ chối
                        </Button>
                      </div>
                    )}
                    {record.status === "rejected" && record.rejectionReason && (
                      <span className="flex items-center justify-end gap-1 text-xs text-red-400">
                        <MessageSquareText className="h-3 w-3"/> Bị từ chối
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION */}
      {data?.data?.meta && data.data.meta.totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={data.data.meta.totalPages}
          onPageChange={setPage}
          totalItems={data.data.meta.total || data.data.meta.totalItems || 0}
          pageSize={data.data.meta.limit || data.data.meta.pageSize || 10}
        />
      )}
      {playingRec && (
        <KaraokePlaybackModal recording={playingRec} onClose={() => setPlayingRec(null)} />
      )}
    </div>
  );
};

export default KaraokeRecordingsTab;
