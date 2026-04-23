import { ILyricLine } from "@/features/track";
import { useEffect, useState, startTransition, useRef } from "react";

export function useLyrics(lyricsUrl?: string) {
  const [lyrics, setLyrics] = useState<ILyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, ILyricLine[]>>(new Map());

  useEffect(() => {
    // No URL → reset everything synchronously, nothing to fetch
    if (!lyricsUrl) {
      setLyrics([]);
      setError(false);
      setLoading(false);
      return;
    }

    // Reset state for new URL before anything async happens
    setError(false);

    // Cache hit → serve immediately, no loading flash
    const cached = cacheRef.current.get(lyricsUrl);
    if (cached) {
      startTransition(() => {
        setLyrics(cached);
        setLoading(false);
      });
      return;
    }

    // Cache miss → show loading, then fetch
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

        cacheRef.current.set(lyricsUrl, parsed);

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
  }, [lyricsUrl]);

  return { lyrics, loading, error };
}
