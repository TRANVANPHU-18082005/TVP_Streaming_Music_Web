import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import verificationApi from "@/features/verification/api/verificationApi";
import { handleError } from "@/utils/handleError";

// --- HOOKS ---
export const useVerification = (initialLimit = 10) => {
  const queryClient = useQueryClient();
  const [filterParams, setFilterParams] = useState({
    status: "pending",
    page: 1,
    limit: initialLimit,
  });

  // 1. Query List (Admin)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["verification-requests", filterParams],
    queryFn: () => verificationApi.getRequests(filterParams),
    // Chỉ fetch khi user là admin (bạn có thể thêm logic check role ở đây)
  });
  const requests = data?.data?.data || [];
  const meta = data?.data?.meta || {
    totalItems: 0,
    page: 1,
    pageSize: initialLimit,
    totalPages: 1,
  };
  const handlePageChange = (p: number) =>
    setFilterParams((prev) => ({ ...prev, page: p }));

  // 2. Submit Mutation (User)
  const submitMutation = useMutation({
    mutationFn: verificationApi.submitRequest,
    onSuccess: () => {
      toast.success("Đã gửi yêu cầu! Vui lòng chờ quản trị viên duyệt.");
      // Redirect hoặc update UI user
    },
    onError: (err: unknown) => handleError(err, "Lỗi gửi yêu cầu"),
  });

  // 3. Review Mutation (Admin)
  const reviewMutation = useMutation({
    mutationFn: verificationApi.reviewRequest,
    onSuccess: () => {
      toast.success("Đã xử lý yêu cầu thành công");
      queryClient.invalidateQueries({ queryKey: ["verification-requests"] });
    },
    onError: (err: unknown) => handleError(err, "Lỗi xử lý"),
  });

  return {
    requests,
    meta,
    isLoading,
    isError,
    error,
    refetch,
    filterParams,
    setFilterParams,
    handlePageChange,
    submitRequest: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
    reviewRequest: reviewMutation.mutate,
    isReviewing: reviewMutation.isPending,
  };
};
