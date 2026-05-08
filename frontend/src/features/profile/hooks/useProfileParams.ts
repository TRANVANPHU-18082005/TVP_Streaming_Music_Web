import { useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { LikedContentParams } from "../types";

export const useProfileParams = (
  defaultType: "track" | "album" | "playlist" = "track",
) => {
  const { params, setParams } = useQueryParams<LikedContentParams & Record<string, unknown>>({
    type: defaultType,
    page: 1,
    limit: 20,
  });

  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ page });
    },
    [setParams],
  );

  const handleTypeChange = useCallback(
    (type: LikedContentParams["type"]) => {
      setParams({ type, page: 1 }); // Đổi tab thì reset về trang 1
    },
    [setParams],
  );

  return {
    params,
    handlePageChange,
    handleTypeChange,
  };
};
