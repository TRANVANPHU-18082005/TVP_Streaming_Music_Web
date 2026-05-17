import { useState, useCallback } from "react";
import { toast } from "sonner";
import { readHistory, writeHistory } from "../utils";
import { MAX_RECENT_SEARCHES } from "../types";

export function useSearchHistory() {
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readHistory(),
  );

  const saveToHistory = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      const next = [
        t,
        ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);
      writeHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setRecentSearches([]);
    writeHistory([]);
    toast.success("Đã xóa lịch sử tìm kiếm");
  }, []);

  return { recentSearches, saveToHistory, removeHistoryItem, clearAllHistory };
}
