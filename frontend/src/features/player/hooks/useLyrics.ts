import { ILyricLine } from "@/features/track";
import { useEffect, useState, startTransition } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL CACHE — persists across FullPlayer mount/unmount cycles.
// User opens player → lyrics fetched once → closes → reopens → served from cache.
// Map key = lyricUrl string, value = parsed ILyricLine[].
// ─────────────────────────────────────────────────────────────────────────────

const lyricsModuleCache = new Map<string, ILyricLine[]>();

// ─────────────────────────────────────────────────────────────────────────────
// useLyrics
//
// @param lyricsUrl  URL của file JSON lyrics
// @param enabled    Chỉ fetch khi true (lazy — mặc định false)
//                   FullPlayer truyền true khi currentView === "lyrics" | "mood"
//
// Performance improvements vs old version:
//   1. Module-level cache (không mất khi FullPlayer unmount)
//   2. enabled=false → zero network, zero state updates
//   3. startTransition cho mọi state update để tránh block UI
// ─────────────────────────────────────────────────────────────────────────────

export function useLyrics(lyricsUrl?: string, enabled: boolean = false) {
  const [lyrics, setLyrics] = useState<ILyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Guard 1: không enabled → không làm gì
    if (!enabled) return;

    // Guard 2: không có URL → reset synchronously
    if (!lyricsUrl) {
      setLyrics([]);
      setError(false);
      setLoading(false);
      return;
    }

    setError(false);

    // Module cache hit → phục vụ ngay, không loading flash
    const cached = lyricsModuleCache.get(lyricsUrl);
    if (cached) {
      startTransition(() => {
        setLyrics(cached);
        setLoading(false);
      });
      return;
    }

    // Cache miss → fetch
    setLoading(true);
    setLyrics([]);

    const controller = new AbortController();

    fetch(lyricsUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const parsed: ILyricLine[] = Array.isArray(data)
          ? data
          : (data.lines ?? []);

        // Lưu vào module cache
        lyricsModuleCache.set(lyricsUrl, parsed);

        startTransition(() => {
          setLyrics(parsed);
          setLoading(false);
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        startTransition(() => {
          setError(true);
          setLoading(false);
        });
      });

    return () => controller.abort();
  }, [lyricsUrl, enabled]);

  return { lyrics, loading, error };
}
