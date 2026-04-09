// hooks/useLyrics.ts
import { ILyricLine } from "@/features/track";
import { useEffect, useState, startTransition, useRef } from "react";

export function useLyrics(lyricsUrl?: string) {
  const [lyrics, setLyrics] = useState<ILyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, ILyricLine[]>>(new Map());

  useEffect(() => {
    // ✅ Reset ngay khi url thay đổi
    startTransition(() => {
      setLyrics([]);
      setError(false);
    });

    if (!lyricsUrl) {
      setLoading(false);
      return;
    }

    // ✅ Trả cache ngay nếu đã fetch trước đó
    const cached = cacheRef.current.get(lyricsUrl);
    if (cached) {
      startTransition(() => {
        setLyrics(cached);
        setLoading(false);
      });
      return;
    }

    setLoading(true);
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

        // ✅ Lưu vào cache
        cacheRef.current.set(lyricsUrl, parsed);

        startTransition(() => {
          setLyrics(parsed);
          setLoading(false);
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          startTransition(() => {
            setError(true);
            setLoading(false);
          });
        }
      });

    return () => controller.abort();
  }, [lyricsUrl]);

  return { lyrics, loading, error };
}
