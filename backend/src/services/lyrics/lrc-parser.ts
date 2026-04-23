import { LyricLine } from "../../types/worker.types";

const TIME_RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

/**
 * Parse an LRC string into timestamped lyric lines.
 * Returns [] if input is empty or contains no valid timestamp lines.
 */
export function parseLRC(lrc: string): LyricLine[] {
  if (typeof lrc !== "string" || lrc.trim().length === 0) return [];

  const raw: { startTime: number; text: string }[] = [];

  for (const line of lrc.split("\n")) {
    const match = TIME_RE.exec(line);
    if (!match) continue;
    const ms =
      parseInt(match[1], 10) * 60_000 +
      parseInt(match[2], 10) * 1_000 +
      parseInt(match[3].padEnd(3, "0").slice(0, 3), 10);
    const text = line.replace(TIME_RE, "").trim();
    if (text) raw.push({ startTime: ms, text });
  }

  if (raw.length === 0) return [];

  return raw.map((line, i) => ({
    ...line,
    endTime: raw[i + 1]?.startTime ?? line.startTime + 5_000,
  }));
}

/**
 * Convert plain text lyrics to LyricLine[] with fake timestamps (~4s/line).
 * Used as a last resort when only plain text is available (no LRC).
 */
export function plainTextToLyricLines(plain: string): LyricLine[] {
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((text, i) => ({
    startTime: i * 4_000,
    endTime: (i + 1) * 4_000,
    text,
  }));
}

/**
 * Strip tags/parentheses and normalise whitespace before feeding
 * plain lyrics into the forced aligner.
 */
export function normaliseForAligner(plainLyrics: string): string {
  return plainLyrics
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/^\s+|\s+$/gm, "")
    .split("\n")
    .filter((ln) => ln.trim().length > 0)
    .join("\n");
}
