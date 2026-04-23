// utils/karaoke.postprocess.ts
//
// Post-processor chạy sau khi Python aligner xuất ra JSON.
// Xử lý 6 loại lỗi còn sót lại trong output:
//
//   PP-1  CamelCase concatenation — "thêmBao" → ["thêm","Bao"]
//   PP-2  Standalone punctuation  — "," standalone → gộp vào từ trước
//   PP-3  Timestamp cluster       — nhiều words cùng startTime → chia đều
//   PP-4  Zero/negative duration  — word.end <= word.start → clamp +80ms
//   PP-5  Line boundary overlap   — words[last].end > next_line.words[0].start
//   PP-6  Line start mismatch     — line.start > words[0].startTime → sync
//   PP-7  Dirty text in line.text — "thêmBao" còn trong text → split thành 2 lines
//
// Dùng như standalone script hoặc import vào Worker.

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface KaraokeWord {
  word: string;
  startTime: number; // ms
  endTime: number; // ms
}

export interface KaraokeLine {
  text: string;
  start: number; // ms
  end: number; // ms
  words: KaraokeWord[];
}

export interface KaraokeJson {
  type: string;
  lines: KaraokeLine[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MIN_WORD_MS = 80; // minimum word duration in ms
const STANDALONE_RE = /^[,\.!?;:…–—]+$/;

// Detect boundary: lowercase Vietnamese char followed by uppercase
const CAMEL_BOUNDARY = /(\p{Ll})([A-Z])/gu;

// ─────────────────────────────────────────────────────────────────────────────
// PP-1: SPLIT CAMELCASE BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

function splitCamelBoundary(word: KaraokeWord): KaraokeWord[] {
  const spaced = word.word.replace(CAMEL_BOUNDARY, "$1 $2");
  const parts = spaced.split(" ").filter(Boolean);

  if (parts.length <= 1) return [word];

  const totalMs = Math.max(
    word.endTime - word.startTime,
    parts.length * MIN_WORD_MS,
  );
  const step = totalMs / parts.length;

  return parts.map((part, i) => ({
    word: part,
    startTime: Math.round(word.startTime + i * step),
    endTime: Math.round(word.startTime + (i + 1) * step),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PP-2: MERGE STANDALONE PUNCTUATION
// ─────────────────────────────────────────────────────────────────────────────

function mergeStandalonePunct(words: KaraokeWord[]): KaraokeWord[] {
  if (!words.length) return words;

  const result: KaraokeWord[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const prev = result[result.length - 1];

    if (STANDALONE_RE.test(w.word)) {
      // Gộp vào từ trước
      result[result.length - 1] = {
        word: prev.word + w.word,
        startTime: prev.startTime,
        endTime: Math.max(prev.endTime, w.endTime),
      };
    } else {
      result.push(w);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PP-3: REPAIR TIMESTAMP CLUSTERS
// ─────────────────────────────────────────────────────────────────────────────

function repairClusters(
  words: KaraokeWord[],
  lineEndMs: number,
): KaraokeWord[] {
  if (!words.length) return words;

  const result = words.map((w) => ({ ...w }));
  const n = result.length;

  let i = 0;
  while (i < n) {
    const clusterStart = result[i].startTime;

    // Collect cluster: words with same startTime or zero duration
    let j = i;
    while (
      j < n &&
      (result[j].startTime === clusterStart ||
        result[j].endTime <= result[j].startTime ||
        (j > i && result[j].startTime === result[j - 1].startTime))
    ) {
      j++;
    }

    const clusterSize = j - i;
    if (clusterSize <= 1) {
      i++;
      continue;
    }

    // Find end boundary for cluster
    const clusterEnd = j < n ? result[j].startTime : lineEndMs;

    const safeEnd =
      clusterEnd > clusterStart
        ? clusterEnd
        : clusterStart + clusterSize * MIN_WORD_MS;

    const step = (safeEnd - clusterStart) / clusterSize;

    for (let k = 0; k < clusterSize; k++) {
      result[i + k].startTime = Math.round(clusterStart + k * step);
      result[i + k].endTime = Math.round(clusterStart + (k + 1) * step);
    }

    i = j;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PP-4: CLAMP ZERO-DURATION WORDS
// ─────────────────────────────────────────────────────────────────────────────

function clampWordDurations(words: KaraokeWord[]): KaraokeWord[] {
  return words.map((w) => {
    if (w.endTime <= w.startTime) {
      return { ...w, endTime: w.startTime + MIN_WORD_MS };
    }
    return w;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PP-5 + PP-6: LINE BOUNDARY SYNC
// ─────────────────────────────────────────────────────────────────────────────

function syncLineBoundaries(lines: KaraokeLine[]): KaraokeLine[] {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.words.length) continue;

    // PP-6: sync line.start to words[0].startTime if mismatched
    const firstWordStart = line.words[0].startTime;
    if (line.start > firstWordStart) {
      // LRC anchor is later than word — clamp words forward
      const delta = line.start - firstWordStart;
      line.words = line.words.map((w) => ({
        ...w,
        startTime: w.startTime + delta,
        endTime: w.endTime + delta,
      }));
    }

    // PP-5: ensure last word of line[i] doesn't overlap line[i+1]
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextLineStart = nextLine.words.length
        ? nextLine.words[0].startTime
        : nextLine.start;

      const lastWord = line.words[line.words.length - 1];
      if (lastWord.endTime > nextLineStart) {
        lastWord.endTime = nextLineStart;
        if (lastWord.startTime >= lastWord.endTime) {
          lastWord.startTime = Math.max(0, lastWord.endTime - MIN_WORD_MS);
        }
      }
    }
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// PP-7: REBUILD LINE TEXT FROM CLEANED WORDS
// ─────────────────────────────────────────────────────────────────────────────

function rebuildLineText(line: KaraokeLine): KaraokeLine {
  // Reconstruct text from cleaned words (removes camelCase artifacts)
  const cleanedText = line.words.map((w) => w.word).join(" ");
  return { ...line, text: cleanedText };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS SINGLE LINE
// ─────────────────────────────────────────────────────────────────────────────

function processLine(line: KaraokeLine): KaraokeLine {
  let words = line.words;

  // PP-1: split camelCase boundaries
  words = words.flatMap(splitCamelBoundary);

  // PP-2: merge standalone punctuation
  words = mergeStandalonePunct(words);

  // PP-3: repair timestamp clusters
  words = repairClusters(words, line.end);

  // PP-4: clamp zero-duration words
  words = clampWordDurations(words);

  // Rebuild line text from cleaned words
  const line2 = rebuildLineText({ ...line, words });

  return line2;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST-PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

export function postProcessKaraoke(input: KaraokeJson): KaraokeJson {
  // Process each line independently
  let lines = input.lines.map(processLine);

  // PP-5 + PP-6: cross-line boundary sync (must run after all lines processed)
  lines = syncLineBoundaries(lines);

  return { ...input, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION REPORT (dev/debug)
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  lineIndex: number;
  lineText: string;
  wordIndex: number;
  word: string;
  issue: string;
}

export function validateKaraoke(data: KaraokeJson): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  data.lines.forEach((line, li) => {
    // Check line duration
    if (line.end <= line.start) {
      issues.push({
        lineIndex: li,
        lineText: line.text,
        wordIndex: -1,
        word: "",
        issue: `Line zero-duration (start=${line.start} end=${line.end})`,
      });
    }

    line.words.forEach((w, wi) => {
      // Zero duration
      if (w.endTime <= w.startTime) {
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: wi,
          word: w.word,
          issue: `Word zero-duration (${w.startTime}-${w.endTime})`,
        });
      }
      // Out of line bounds
      if (w.startTime < line.start) {
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: wi,
          word: w.word,
          issue: `Word startTime ${w.startTime} < line.start ${line.start}`,
        });
      }
      if (w.endTime > line.end + 500) {
        // 500ms tolerance for last word
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: wi,
          word: w.word,
          issue: `Word endTime ${w.endTime} > line.end ${line.end}`,
        });
      }
      // CamelCase still present
      if (CAMEL_BOUNDARY.test(w.word)) {
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: wi,
          word: w.word,
          issue: `CamelCase boundary still present`,
        });
      }
      // Standalone punctuation
      if (STANDALONE_RE.test(w.word)) {
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: wi,
          word: w.word,
          issue: `Standalone punctuation`,
        });
      }
    });

    // Cross-line overlap
    if (li + 1 < data.lines.length) {
      const nextLine = data.lines[li + 1];
      const lastWord = line.words[line.words.length - 1];
      const nextFirst = nextLine.words[0];
      if (lastWord && nextFirst && lastWord.endTime > nextFirst.startTime) {
        issues.push({
          lineIndex: li,
          lineText: line.text,
          wordIndex: line.words.length - 1,
          word: lastWord.word,
          issue: `Overlap: word.endTime=${lastWord.endTime} > next_line.words[0].startTime=${nextFirst.startTime}`,
        });
      }
    }
  });

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI USAGE
// node -e "require('./karaoke.postprocess').runCli()" -- input.json output.json
// ─────────────────────────────────────────────────────────────────────────────

export async function runCli(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: ts-node karaoke.postprocess.ts <input.json> <output.json>",
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as KaraokeJson;

  console.log(`[PostProcess] Input: ${data.lines.length} lines`);

  const cleaned = postProcessKaraoke(data);

  // Validate before writing
  const issues = validateKaraoke(cleaned);
  if (issues.length > 0) {
    console.warn(
      `[PostProcess] ${issues.length} validation issue(s) remaining:`,
    );
    issues.slice(0, 10).forEach((iss) => {
      console.warn(`  Line ${iss.lineIndex} word "${iss.word}": ${iss.issue}`);
    });
  } else {
    console.log("[PostProcess] ✅ Validation passed — 0 issues.");
  }

  fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2), "utf-8");

  const totalWords = cleaned.lines.reduce((s, l) => s + l.words.length, 0);
  console.log(
    `[PostProcess] Done. ${cleaned.lines.length} lines / ${totalWords} words → ${outputPath}`,
  );
}

// Run as script
if (require.main === module) {
  runCli().catch((err) => {
    console.error("[PostProcess] Fatal:", err);
    process.exit(1);
  });
}
