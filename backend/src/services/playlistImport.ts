export const MAX_IMPORT_LINES = 200;

export interface ParsedImportLine {
  line: string;
  query: string;
  parts: string[];
}

export interface ImportCandidateView {
  id: string;
  title: string;
  artistName: string;
  artistNames: string[];
  coverImage: string;
  playCount: number;
}

const ACCENT_GROUPS: Record<string, string> = {
  a: "aàáảãạăằắẳẵặâầấẩẫậAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ",
  e: "eèéẻẽẹêềếểễệEÈÉẺẼẸÊỀẾỂỄỆ",
  i: "iìíỉĩịIÌÍỈĨỊ",
  o: "oòóỏõọôồốổỗộơờớởỡợOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ",
  u: "uùúủũụưừứửữựUÙÚỦŨỤƯỪỨỬỮỰ",
  y: "yỳýỷỹỵYỲÝỶỸỴ",
  d: "dđDĐ",
};

const TITLE_SUFFIX =
  /^(remix|live|cover|acoustic|version|ver|ost|radio edit|lofi|lo fi|karaoke|instrumental|inst|sped up|slowed|piano|ballad)$/;

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return foldText(value).replace(/\s+/g, "");
}

export function accentPattern(folded: string): string {
  let pattern = "";
  for (const char of folded) {
    const group = ACCENT_GROUPS[char];
    if (group) pattern += `[${group}]`;
    else if (char === " ") pattern += "\\s+";
    else pattern += char;
  }
  return pattern;
}

function splitParts(query: string): string[] {
  const byDash = query
    .split(/\s+[-–—|]\s+|\s+\/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  if (byDash.length > 1) return byDash.slice(0, 3);

  const byComma = query
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  if (byComma.length >= 2 && byComma.length <= 3) return byComma;
  return [query];
}

export function parseImportLines(text: string): {
  lines: ParsedImportLine[];
  overflow: boolean;
} {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const lines: ParsedImportLine[] = [];

  for (const row of rows) {
    const original = row.trim();
    if (!original) continue;

    let query = original.replace(/^\d{1,3}\s*[.)\-:]\s+/, "").trim();
    query = query.replace(/^["“”']+|["“”']+$/g, "").trim();
    if (query.length < 2) continue;
    if (query.length > 200) query = query.slice(0, 200);

    if (lines.length >= MAX_IMPORT_LINES) {
      return { lines, overflow: true };
    }

    lines.push({
      line: original.slice(0, 200),
      query,
      parts: splitParts(query),
    });
  }

  return { lines, overflow: false };
}

export function searchPhrases(parsed: ParsedImportLine): string[] {
  const withoutNotes = parsed.query
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const raw = [...parsed.parts, parsed.query];
  if (withoutNotes && withoutNotes !== parsed.query) raw.push(withoutNotes);

  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const item of raw) {
    const folded = foldText(item);
    if (folded.length < 2 || seen.has(folded)) continue;
    seen.add(folded);
    phrases.push(item.trim());
  }
  return phrases.slice(0, 4);
}

function artistMatches(names: string[], hint: string): boolean {
  const hintCompact = compact(hint);
  if (hintCompact.length < 2) return false;
  return names.some((name) => {
    const artistCompact = compact(name);
    if (!artistCompact) return false;
    if (artistCompact === hintCompact) return true;
    if (hintCompact.length < 4 || artistCompact.length < 4) return false;
    return (
      artistCompact.includes(hintCompact) || hintCompact.includes(artistCompact)
    );
  });
}

function scoreCandidate(
  candidate: ImportCandidateView,
  parsed: ParsedImportLine,
): number {
  const title = foldText(candidate.title);
  const query = foldText(parsed.query);
  if (!title || !query) return 0;

  const parts = parsed.parts
    .map((part) => foldText(part))
    .filter((part) => part.length >= 2);
  const titleMatchedPart = parts.find((part) => part === title);

  const hints = parts.filter((part) => part !== title);
  const artistOk = hints.some((hint) =>
    artistMatches(candidate.artistNames, hint),
  );
  const longest = parts.reduce(
    (best, part) => (part.length > best.length ? part : best),
    "",
  );

  let score = 0;
  if (title === query) score = 1000;
  else if (titleMatchedPart && artistOk) score = 950;
  else if (titleMatchedPart && title === longest) score = 900;
  else if (title.startsWith(query) && query.length >= 8) {
    const extra = title.slice(query.length).trim();
    if (TITLE_SUFFIX.test(extra)) score = 860;
  } else if (query.startsWith(title) && title.length >= 8) {
    const extra = query.slice(title.length).trim();
    if (!extra || TITLE_SUFFIX.test(extra)) score = 840;
  }

  return score;
}

export function pickImportTrack(
  candidates: ImportCandidateView[],
  parsed: ParsedImportLine,
): ImportCandidateView | null {
  let best: { candidate: ImportCandidateView; score: number } | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, parsed);
    if (score < 840) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && candidate.playCount > best.candidate.playCount)
    ) {
      best = { candidate, score };
    }
  }

  return best?.candidate ?? null;
}
