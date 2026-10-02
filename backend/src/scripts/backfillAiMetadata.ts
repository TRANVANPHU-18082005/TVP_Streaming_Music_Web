/**
 * Backfill Track.aiMetadata without Gemini.
 *
 * export writes tracks that have no aiMetadata.analyzedAt.
 * The metadata file is authored separately, then apply writes it.
 *
 *   npm run backfill:ai-metadata -- export
 *   npm run backfill:ai-metadata -- apply
 *   npm run backfill:ai-metadata -- apply --dry-run
 *
 * Does not change track status. Skips tracks that already have analyzedAt.
 */
import dns from "dns";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import config from "../config/env";
import "../models/Artist";
import "../models/Genre";
import Track from "../models/Track";
import MoodVideoService from "../services/moodVideo.service";
import { invalidateTracksCache } from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";

const MOODS = [
  "happy",
  "sad",
  "romantic",
  "energetic",
  "chill",
  "melancholic",
  "aggressive",
  "peaceful",
  "dreamy",
  "dark",
  "uplifting",
  "nostalgic",
] as const;

const CONTEXTS = [
  "study",
  "gym",
  "driving",
  "sleep",
  "party",
  "morning",
  "cooking",
  "rain",
  "commute",
  "meditation",
  "date",
  "gaming",
] as const;

const ANALYSIS_VERSION = 2;
const LYRIC_LIMIT = 2000;

const dataDir = path.join(__dirname, "data");
const exportPath = path.join(dataDir, "tracks-missing-aimetadata.json");
const backfillPath = path.join(dataDir, "ai-metadata.backfill.json");

const missingAnalyzedAt = {
  status: "ready" as const,
  isDeleted: false,
  $or: [
    { "aiMetadata.analyzedAt": { $exists: false } },
    { "aiMetadata.analyzedAt": null },
  ],
};

interface ExportedTrack {
  _id: string;
  title: string;
  artist: string;
  genres: string[];
  tags: string[];
  releaseDate: string | null;
  plainLyrics: string;
}

interface AuthoredMetadata {
  meaning?: string;
  emotion?: string;
  musicalStyle?: string;
  similarKeywords?: string[];
  moods?: string[];
  contexts?: string[];
  language?: string;
  era?: string;
  colorHex?: string;
  energy?: number;
  tempo?: number;
  musicalKey?: string;
}

interface BackfillEntry {
  _id: string;
  aiMetadata: AuthoredMetadata;
}

function readArgs(argv: string[]): { command: string; dryRun: boolean } {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const dryRun = args.includes("--dry-run");
  const command = args.find((arg) => arg !== "--dry-run") ?? "";
  return { command, dryRun };
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function uniqueLower(values: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const next = value.trim().toLowerCase();
    if (!next || seen.has(next)) continue;
    if (allowed && !allowed.includes(next)) continue;
    seen.add(next);
    result.push(next);
  }
  return result;
}

function sanitizeMetadata(input: AuthoredMetadata): AuthoredMetadata {
  const meaning = clip(input.meaning, 2000);
  const emotion = clip(input.emotion, 80);
  const musicalStyle = clip(input.musicalStyle, 300);
  const language = clip(input.language, 12).toLowerCase();
  const era = clip(input.era, 20);
  const musicalKey = clip(input.musicalKey, 16);
  const colorHex = clip(input.colorHex, 7);
  const moods = uniqueLower(input.moods, MOODS).slice(0, 3);
  const contexts = uniqueLower(input.contexts, CONTEXTS).slice(0, 3);
  const similarKeywords = uniqueLower(input.similarKeywords).slice(0, 8);

  let energy: number | undefined;
  if (typeof input.energy === "number" && Number.isFinite(input.energy)) {
    energy = Math.min(1, Math.max(0, Number(input.energy.toFixed(2))));
  }

  let tempo: number | undefined;
  if (typeof input.tempo === "number" && Number.isFinite(input.tempo) && input.tempo > 0) {
    tempo = Math.round(input.tempo);
  }

  const metadata: AuthoredMetadata = {};
  if (meaning) metadata.meaning = meaning;
  if (emotion) metadata.emotion = emotion;
  if (musicalStyle) metadata.musicalStyle = musicalStyle;
  if (language) metadata.language = language;
  if (era) metadata.era = era;
  if (musicalKey) metadata.musicalKey = musicalKey;
  if (/^#[0-9a-fA-F]{6}$/.test(colorHex)) metadata.colorHex = colorHex.toLowerCase();
  if (moods.length) metadata.moods = moods;
  if (contexts.length) metadata.contexts = contexts;
  if (similarKeywords.length) metadata.similarKeywords = similarKeywords;
  if (energy !== undefined) metadata.energy = energy;
  if (tempo !== undefined) metadata.tempo = tempo;
  return metadata;
}

async function connectMongo(): Promise<void> {
  if (!config.mongoUri) {
    console.error("MONGO_URI is not set");
    process.exitCode = 1;
    throw new Error("MONGO_URI is not set");
  }
  try {
    await mongoose.connect(config.mongoUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Node in some shells only lists 127.0.0.1, which refuses SRV lookups.
    const loopbackDns = dns.getServers().every((server) => server === "127.0.0.1" || server === "::1");
    if (!loopbackDns || !message.includes("querySrv") || !message.includes("ECONNREFUSED")) {
      throw error;
    }
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(config.mongoUri);
  }
}

async function exportTracks(): Promise<void> {
  const tracks = await Track.find(missingAnalyzedAt)
    .select("title artist genres tags releaseDate plainLyrics")
    .populate("artist", "name")
    .populate("genres", "name")
    .sort({ _id: 1 })
    .lean();

  const rows: ExportedTrack[] = tracks.map((track) => {
    const artist = track.artist as { name?: string } | null;
    const genres = Array.isArray(track.genres)
      ? track.genres.map((genre) => {
          if (genre && typeof genre === "object" && "name" in genre) {
            return String((genre as { name?: string }).name ?? "");
          }
          return "";
        }).filter(Boolean)
      : [];

    return {
      _id: String(track._id),
      title: track.title ?? "",
      artist: artist?.name ?? "",
      genres,
      tags: Array.isArray(track.tags) ? track.tags.filter((tag) => typeof tag === "string") : [],
      releaseDate: track.releaseDate ? new Date(track.releaseDate).toISOString() : null,
      plainLyrics: clip(track.plainLyrics, LYRIC_LIMIT),
    };
  });

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(exportPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Exported ${rows.length} tracks to ${exportPath}`);
}

function readBackfillFile(): BackfillEntry[] {
  if (!fs.existsSync(backfillPath)) {
    throw new Error(`Missing backfill file: ${backfillPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(backfillPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Backfill file must be a JSON array");
  }
  return parsed.filter((entry): entry is BackfillEntry => {
    return Boolean(entry) && typeof entry === "object" && typeof (entry as BackfillEntry)._id === "string";
  });
}

async function applyBackfill(dryRun: boolean): Promise<void> {
  const entries = readBackfillFile();
  const updatedIds: string[] = [];
  let skipped = 0;
  let matchedMood = 0;

  for (const entry of entries) {
    if (!mongoose.Types.ObjectId.isValid(entry._id)) {
      skipped += 1;
      continue;
    }

    const metadata = sanitizeMetadata(entry.aiMetadata ?? {});
    const filter = { _id: entry._id, ...missingAnalyzedAt };
    const existing = await Track.findOne(filter).select("tags").lean<{ tags?: string[] }>();
    if (!existing) {
      skipped += 1;
      continue;
    }

    const tags = Array.isArray(existing.tags) ? existing.tags : [];
    const moods = metadata.moods ?? [];
    let moodVideoId: mongoose.Types.ObjectId | undefined;
    if (moods.length || tags.length) {
      moodVideoId = await MoodVideoService.matchMoodCanvas(tags, moods, "backfill-ai");
      if (moodVideoId) matchedMood += 1;
    }

    if (dryRun) {
      updatedIds.push(entry._id);
      continue;
    }

    const result = await Track.updateOne(filter, {
      $set: {
        aiMetadata: {
          ...metadata,
          analyzedAt: new Date(),
          analysisVersion: ANALYSIS_VERSION,
        },
        ...(moodVideoId ? { moodVideo: moodVideoId } : {}),
      },
    });

    if (result.modifiedCount === 1) updatedIds.push(entry._id);
    else skipped += 1;
  }

  if (!dryRun && updatedIds.length) {
    try {
      if (cacheRedis.status === "wait") await cacheRedis.connect();
      await invalidateTracksCache(updatedIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Cache invalidation failed: ${message}`);
    }
  }

  console.log(
    `${dryRun ? "Dry run" : "Applied"} ${updatedIds.length} tracks, skipped ${skipped}, mood canvas ${matchedMood}.`,
  );
}

async function main(): Promise<void> {
  const { command, dryRun } = readArgs(process.argv);
  if (command !== "export" && command !== "apply") {
    console.error("Usage: npm run backfill:ai-metadata -- export|apply [--dry-run]");
    process.exitCode = 1;
    return;
  }

  await connectMongo();
  if (command === "export") await exportTracks();
  else await applyBackfill(dryRun);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`AI metadata backfill failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
    if (cacheRedis.status !== "wait" && cacheRedis.status !== "end") {
      await cacheRedis.quit().catch(() => undefined);
    }
    process.exit(process.exitCode ?? 0);
  });
