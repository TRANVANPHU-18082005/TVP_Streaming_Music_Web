#!/usr/bin/env ts-node
/*
  migrate-tracks-to-cdn.ts

  Safe migration script to convert Track documents' storage URLs
  (coverImage, hlsUrl, lyricUrl) from Backblaze B2 endpoints to CDN domain
  using the existing backend `toCdnUrl` logic.

  Usage (dry-run):
    DOTENV_ENV=staging npm run ts-node -- migrations/migrate-tracks-to-cdn.ts --dry

  Usage (apply):
    DOTENV_ENV=production npm run ts-node -- migrations/migrate-tracks-to-cdn.ts

  The script supports `--dry` to only log planned changes without writing.
*/

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

// Load env from backend root .env by default
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Import Track model and helper — use runtime requires to avoid tsconfig path issues
const { default: TrackModel } = require("../src/models/Track");
function buildBaseUrl(): string {
  // const isProd = config.nodeEnv === "production";
  // const raw = isProd ? config.cdnDomain || config.b2.endpoint : config.b2.endpoint;
  const raw = "https://cdn.tvpmusic.site";
  if (!raw) throw new Error(`[buildBaseUrl] Missing configuration for CDN/B2 endpoint`);
  return raw.replace(/\/+$/, "");
}
function extractRelativePath(
  fileUrl: string,
  bucketName: string,
): string {
  const url = new URL(fileUrl);

  // Case 1: virtual-hosted-style (bucket ở subdomain)
  if (url.hostname.startsWith(bucketName)) {
    return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
  }

  // Case 2: path-style (bucket nằm trong path)
  const marker = `${bucketName}/`;
  if (url.pathname.includes(marker)) {
    return url.pathname.split(marker)[1];
  }

  throw new Error(
    `[extractRelativePath] Cannot extract path from "${fileUrl}" with bucket "${bucketName}".`,
  );
}
function toCdnUrl(fileUrl: string): string {
  try {
    const bucket = "tvp-music-hls";
    if (!bucket) return fileUrl;
    const rel = extractRelativePath(fileUrl, bucket);
    const base = buildBaseUrl();
    // return `${base}/${bucket}/${rel}`;
    return `${base}/file/${bucket}/${rel}`;
  } catch (err) {
    return fileUrl;
  }
}
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry") || args.includes("-n");

  const mongoUri ="mongodb+srv://tranvanphu1882005z:TranVanPhu18082005@cluster0.hmcg1pr.mongodb.net/TVP_music?retryWrites=true&w=majority"
;
  if (!mongoUri) {
    console.error("Missing MongoDB connection string. Set MONGO_URI in environment.");
    process.exit(2);
  }

  console.log(`Connecting to MongoDB: ${mongoUri.replace(/(:).*@/, ":***@")}`);
  await mongoose.connect(mongoUri, { autoIndex: false });

  try {
    // Iterate in batches to avoid large memory usage
    const batchSize = 200;
    const total = await TrackModel.countDocuments();
    console.log(`Found ${total} tracks. Scanning in batches of ${batchSize}...`);

    let updated = 0;
    for (let skip = 0; skip < total; skip += batchSize) {
      const docs = await TrackModel.find().skip(skip).limit(batchSize).lean();
      const ops: any[] = [];

      for (const doc of docs) {
        const updates: any = {};

        // Only attempt conversion when field exists and is a string
        if (doc.coverImage && typeof doc.coverImage === "string") {
          const newUrl = toCdnUrl(doc.coverImage);
          if (newUrl && newUrl !== doc.coverImage) updates.coverImage = newUrl;
        }

        if (doc.hlsUrl && typeof doc.hlsUrl === "string") {
          const newUrl = toCdnUrl(doc.hlsUrl);
          if (newUrl && newUrl !== doc.hlsUrl) updates.hlsUrl = newUrl;
        }

        if (doc.lyricUrl && typeof doc.lyricUrl === "string") {
          const newUrl = toCdnUrl(doc.lyricUrl);
          if (newUrl && newUrl !== doc.lyricUrl) updates.lyricUrl = newUrl;
        }

        if (Object.keys(updates).length > 0) {
          if (dryRun) {
            console.log(`[dry] would update ${doc._id}:`, updates);
          } else {
            ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: updates } } });
          }
        }
      }

      if (!dryRun && ops.length) {
        const res = await TrackModel.bulkWrite(ops, { ordered: false });
        updated += res.nModified || res.modifiedCount || 0;
        console.log(`Batch skip=${skip} applied, modified ${res.nModified || res.modifiedCount || 0}`);
      }
    }

    if (dryRun) console.log("Dry run complete — no documents were modified.");
    else console.log(`Migration complete — total modified: ${updated}`);
  } catch (err) {
    console.error("Migration error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
