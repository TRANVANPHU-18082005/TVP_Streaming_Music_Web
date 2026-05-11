import { useState } from "react";
import { format } from "date-fns";
import {
  Check,
  X,
  Eye,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Filter,
  User,
  Mail,
  Link as LinkIcon,
  FileImage,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useVerification } from "@/features/verification/hooks/useVerification";
import PageHeader from "@/components/ui/PageHeader"; // Giả sử đã có
import Pagination from "@/utils/pagination"; // Giả sử đã có
import MusicResult from "@/components/ui/Result"; // Giả sử đã có
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import TableSkeleton from "@/components/ui/TableSkeleton"; // Giả sử đã có
import { APP_CONFIG } from "@/config/constants";

export const VerificationManager = () => {
  const {
    requests,
    isLoading,
    reviewRequest,
    filterParams,
    setFilterParams,
    handlePageChange,
    meta,
  } = useVerification();
  const totalPages = meta.totalPages || 0;
  const totalItems = meta.totalItems || 0;
  // State Modal
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectMode, setIsRejectMode] = useState(false);

  const handleReview = (status: "approved" | "rejected") => {
    if (status === "rejected" && !rejectReason) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }

    reviewRequest(
      {
        id: selectedRequest._id,
        status,
        rejectReason: status === "rejected" ? rejectReason : undefined,
      },
      {
        onSuccess: () => {
          setSelectedRequest(null);
          setIsRejectMode(false);
          setRejectReason("");
        },
      },
    );
  };

  const statusColors = {
    pending:
      "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800",
    approved:
      "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
  };

  const statusIcons = {
    pending: <Clock className="w-3 h-3 mr-1" />,
    approved: <ShieldCheck className="w-3 h-3 mr-1" />,
    rejected: <ShieldAlert className="w-3 h-3 mr-1" />,
  };

  return (
    <div className="space-y-8 pb-12">
      {/* --- HEADER --- */}
      <PageHeader
        title="Verification Requests"
        subtitle="Manage artist verification applications."
        action={
          <div className="flex gap-2">
            {["pending", "approved", "rejected"].map((status) => (
              <Button
                key={status}
                variant={filterParams.status === status ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setFilterParams({
                    ...filterParams,
                    status: status as any,
                    page: 1,
                  })
                }
                className={cn(
                  "capitalize font-bold border-input",
                  filterParams.status === status && "shadow-md",
                )}
              >
                {status}
              </Button>
            ))}
          </div>
        }
      />

      {/* --- TABLE CONTENT --- */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50 hover:bg-secondary/50">
            <TableRow className="border-b border-border">
              <TableHead className="w-[300px] font-bold text-foreground/80 tracking-wide">
                User / Applicant
              </TableHead>
              <TableHead className="font-bold text-foreground/80 tracking-wide">
                Artist Name
              </TableHead>
              <TableHead className="hidden md:table-cell font-bold text-foreground/80 tracking-wide">
                Date
              </TableHead>
              <TableHead className="font-bold text-foreground/80 tracking-wide">
                Status
              </TableHead>
              <TableHead className="text-right font-bold text-foreground/80 tracking-wide">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center">
                  <MusicResult
                    variant="empty"
                    title="No requests found"
                    description="There are no verification requests matching your filter."
                  />
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req: any) => (
                <TableRow
                  key={req._id}
                  className="group hover:bg-muted/40 transition-colors border-b border-border/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted border border-border overflow-hidden shrink-0">
                        <img
                          src={req.user?.avatar || "/default-avatar.png"}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-foreground">
                          {req.realName}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Mail className="size-3" /> {req.user?.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-base text-primary">
                      {req.artistName}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-medium">
                    {format(new Date(req.createdAt), "dd MMM yyyy, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize font-bold shadow-sm px-2.5 py-0.5",
                        statusColors[req.status as keyof typeof statusColors],
                      )}
                    >
                      {statusIcons[req.status as keyof typeof statusIcons]}
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedRequest(req)}
                      className="font-bold text-xs uppercase hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-2" /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {requests.length > 0 && (
        <Pagination
          currentPage={filterParams.page}
          totalPages={totalPages || 1}
          onPageChange={handlePageChange}
          totalItems={totalItems}
          pageSize={APP_CONFIG.PAGINATION_LIMIT || 10}
        />
      )}
      {/* --- REVIEW MODAL --- */}
      {selectedRequest && (
        <Dialog
          open={!!selectedRequest}
          onOpenChange={() => {
            setSelectedRequest(null);
            setIsRejectMode(false);
          }}
        >
          <DialogContent className="max-w-4xl h-[100dvh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none sm:border sm:border-border sm:rounded-2xl">
            <DialogHeader className="px-6 py-4 border-b border-border bg-background shrink-0">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span>Review Verification</span>
                  <span className="text-xs font-normal text-muted-foreground mt-0.5 uppercase tracking-wider">
                    Request ID: {selectedRequest._id.slice(-8)}
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 bg-muted/5">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cột trái: Thông tin Text */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                      Applicant Information
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="size-4 text-primary" />
                          <span className="text-xs font-bold uppercase text-muted-foreground">
                            Real Name
                          </span>
                        </div>
                        <p className="font-bold text-lg">
                          {selectedRequest.realName}
                        </p>
                      </div>
                      <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="size-4 text-primary" />
                          <span className="text-xs font-bold uppercase text-muted-foreground">
                            Work Email
                          </span>
                        </div>
                        <p className="font-bold text-base break-all">
                          {selectedRequest.emailWork}
                        </p>
                      </div>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <LinkIcon className="size-4 text-primary" />
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Social Presence
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {selectedRequest.socialLinks.map(
                          (link: string, i: number) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors truncate block"
                            >
                              {link}
                            </a>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  {/* REJECT FORM (Nếu bật) */}
                  {isRejectMode && (
                    <div className="bg-destructive/5 border border-destructive/30 p-5 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-2 text-destructive mb-3">
                        <ShieldAlert className="size-5" />
                        <span className="font-bold text-sm uppercase">
                          Rejection Reason
                        </span>
                      </div>
                      <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Please provide a reason for rejection (e.g., blurry ID, mismatch info)..."
                        className="bg-background border-destructive/30 focus-visible:ring-destructive/30 min-h-[100px]"
                      />
                    </div>
                  )}
                </div>

                {/* Cột phải: Ảnh CCCD */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
                    <FileImage className="size-4" /> Identity Verification
                    Documents
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase ml-1">
                        Front Side
                      </span>
                      <div className="rounded-xl overflow-hidden border-2 border-border shadow-sm bg-black/5 aspect-[1.6]">
                        <img
                          src={selectedRequest.idCardImages[0]}
                          className="w-full h-full object-contain hover:scale-105 transition-transform cursor-zoom-in"
                          alt="ID Front"
                          onClick={() =>
                            window.open(
                              selectedRequest.idCardImages[0],
                              "_blank",
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase ml-1">
                        Back Side
                      </span>
                      <div className="rounded-xl overflow-hidden border-2 border-border shadow-sm bg-black/5 aspect-[1.6]">
                        <img
                          src={selectedRequest.idCardImages[1]}
                          className="w-full h-full object-contain hover:scale-105 transition-transform cursor-zoom-in"
                          alt="ID Back"
                          onClick={() =>
                            window.open(
                              selectedRequest.idCardImages[1],
                              "_blank",
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 sm:p-6 border-t border-border bg-background shrink-0 gap-3">
              {selectedRequest.status === "pending" ? (
                <>
                  {!isRejectMode ? (
                    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:justify-between items-center">
                      <Button
                        variant="ghost"
                        onClick={() => setIsRejectMode(true)}
                        className="w-full sm:w-auto text-destructive hover:bg-destructive/10 font-bold"
                      >
                        <X className="w-4 h-4 mr-2" /> Reject Request
                      </Button>
                      <div className="flex gap-3 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedRequest(null)}
                          className="flex-1 sm:flex-none font-bold"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleReview("approved")}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
                        >
                          <Check className="w-4 h-4 mr-2" /> Approve & Verify
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 w-full justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => setIsRejectMode(false)}
                        className="font-bold"
                      >
                        Back
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReview("rejected")}
                        className="font-bold shadow-lg shadow-destructive/20"
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className={cn(
                    "w-full text-center py-3 rounded-lg font-bold uppercase tracking-wide border",
                    selectedRequest.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                      : "bg-red-500/10 text-red-600 border-red-200",
                  )}
                >
                  Request already processed: {selectedRequest.status}
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
