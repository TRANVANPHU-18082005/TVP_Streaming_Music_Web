import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import authApi from "../api/authApi";
import { AuthProviderType, UserIdentity } from "../types";
import { handleError } from "@/utils/handleError";

export const useLinkedAccounts = () => {
  const queryClient = useQueryClient();

  // 1. Fetch danh sách tài khoản liên kết (Identities)
  const {
    data: identities = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["auth", "identities"],
    queryFn: async () => {
      const res = await authApi.getIdentities();
      return res.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // 2. Mutation Liên kết tài khoản mới
  const linkMutation = useMutation({
    mutationFn: (payload: {
      provider: AuthProviderType;
      providerUserId: string;
      providerEmail: string;
    }) => authApi.linkProvider(payload),
    onSuccess: (res, variables) => {
      toast.success(`Đã liên kết thành công với ${variables.provider.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["auth", "identities"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err: any) => {
      const errorCode = err?.response?.data?.errorCode || err?.data?.errorCode;
      const message = err?.response?.data?.message || err?.message || "Không thể liên kết tài khoản.";

      if (errorCode === "IDENTITY_ALREADY_LINKED") {
        toast.error("Liên kết thất bại", {
          description: "Tài khoản mạng xã hội này đã được kết nối với một người dùng khác hoặc đã được kết nối.",
        });
      } else {
        toast.error("Lỗi liên kết", { description: message });
      }
    },
  });

  // 3. Mutation Hủy liên kết tài khoản
  const unlinkMutation = useMutation({
    mutationFn: (provider: AuthProviderType) => authApi.unlinkProvider(provider),
    onSuccess: (res, provider) => {
      toast.success(`Đã hủy liên kết ${provider.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["auth", "identities"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err: any) => {
      const errorCode = err?.response?.data?.errorCode || err?.data?.errorCode;
      const message = err?.response?.data?.message || err?.message || "Không thể hủy liên kết tài khoản.";

      if (errorCode === "CANNOT_UNLINK_LAST_PROVIDER") {
        toast.error("Không thể hủy liên kết", {
          description: "Bạn phải giữ ít nhất 1 phương thức đăng nhập để đảm bảo an toàn cho tài khoản.",
        });
      } else {
        toast.error("Lỗi hủy liên kết", { description: message });
      }
    },
  });

  return {
    identities,
    isLoading,
    isError,
    refetch,
    linkProvider: linkMutation.mutate,
    isLinking: linkMutation.isPending,
    unlinkProvider: unlinkMutation.mutate,
    isUnlinking: unlinkMutation.isPending,
  };
};
