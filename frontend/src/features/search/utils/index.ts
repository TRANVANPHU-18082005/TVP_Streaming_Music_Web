import React from "react";
import { STORAGE_KEY } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL-STORAGE HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function writeHistory(arr: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT HELPER
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap matching segments of `text` in a styled <span>. */

/** Wrap matching segments of `text` in a styled <span>. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  const res = parts.map((part, i) =>
    // 🚀 SỬA TẠI ĐÂY: Dùng hàm của React thay vì viết thẻ trực tiếp để hợp pháp hóa trong file .ts
    i % 2 === 1
      ? React.createElement(
          "span",
          { key: i, className: "text-primary font-bold" },
          part,
        )
      : part,
  );

  return res.length > 1 ? res : text;
}
