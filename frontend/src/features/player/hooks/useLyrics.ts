// hooks/useLyrics.ts
import { ILyricLine } from "@/features/track";
import { useEffect, useState, startTransition } from "react";

export function useLyrics(lyricsUrl?: string) {
  const [lyrics, setLyrics] = useState<ILyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!lyricsUrl) return;

    setLoading(true);
    setError(false);

    const controller = new AbortController();

    fetch(lyricsUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        startTransition(() => {
          setLyrics(Array.isArray(data) ? data : (data.lines ?? []));
          setLoading(false);
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [lyricsUrl]);

  return { lyrics, loading, error };
}
