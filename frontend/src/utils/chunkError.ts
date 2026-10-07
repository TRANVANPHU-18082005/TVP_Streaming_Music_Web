/**
 * Lỗi tải lazy chunk (thường xảy ra sau khi deploy bản mới, file hash cũ không còn).
 * Cách khắc phục: tải lại trang để lấy bản mới.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "");
  const name = (error as { name?: string } | null)?.name ?? "";
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message)
  );
}
