/**
 * Read-only audit of Track.hlsUrl / status. Writes nothing.
 *
 * Groups tracks by status, hlsUrl host, path shape, bucket match and by
 * whether they were last updated before or after the playback hardening
 * commit (2026-10-01). Prints a few sample ids per group so they can be
 * curl-checked.
 *
 *   npm run audit:hls
 */
import mongoose from "mongoose";
import config from "../config/env";
import Track from "../models/Track";

const CUTOFF = new Date("2026-10-01T00:00:00+07:00");
const SAMPLES_PER_GROUP = 3;

type Row = {
  _id: mongoose.Types.ObjectId;
  status?: string;
  errorReason?: string;
  hlsUrl?: string;
  trackUrl?: string;
  updatedAt?: Date;
};

function classify(row: Row, bucket: string, cdnHost: string): string {
  const status = row.status ?? "unknown";
  const hls = (row.hlsUrl ?? "").trim();
  if (!hls) {
    return `status=${status} | hlsUrl=EMPTY | trackUrl=${row.trackUrl ? "yes" : "no"}`;
  }

  let url: URL;
  try {
    url = new URL(hls);
  } catch {
    return `status=${status} | hlsUrl=MALFORMED`;
  }

  const host = url.hostname.toLowerCase();
  let hostKind = "other";
  if (cdnHost && host === cdnHost) hostKind = "cdn";
  else if (/^s3\..*\.backblazeb2\.com$/.test(host)) hostKind = "b2-s3-endpoint";
  else if (/^f\d+\.backblazeb2\.com$/.test(host)) hostKind = "b2-friendly";
  else if (host.endsWith(".backblazeb2.com")) hostKind = "b2-virtual-host";

  const hasFileSegment = url.pathname.startsWith("/file/");
  const bucketInPath = bucket
    ? url.pathname.startsWith(`/file/${bucket}/`) ||
      url.pathname.startsWith(`/${bucket}/`)
    : false;
  const isM3u8 = url.pathname.endsWith(".m3u8");
  const era =
    row.updatedAt && row.updatedAt >= CUTOFF ? "after-1Oct" : "before-1Oct";

  return [
    `status=${status}`,
    `host=${hostKind}(${host})`,
    `file/=${hasFileSegment ? "yes" : "NO"}`,
    `bucketInPath=${bucketInPath ? "yes" : "NO"}`,
    `m3u8=${isM3u8 ? "yes" : "NO"}`,
    era,
  ].join(" | ");
}

async function auditHlsUrls(): Promise<void> {
  if (!config.mongoUri) {
    console.error("MONGO_URI is not set");
    process.exitCode = 1;
    return;
  }

  const bucket = config.b2.bucketName?.trim() ?? "";
  let cdnHost = "";
  try {
    if (config.cdnDomain) {
      cdnHost = new URL(
        config.cdnDomain.startsWith("http")
          ? config.cdnDomain
          : `https://${config.cdnDomain}`,
      ).hostname.toLowerCase();
    }
  } catch {
    cdnHost = "";
  }

  console.log(`Configured CDN host : ${cdnHost || "(CDN_DOMAIN not set)"}`);
  console.log(`Configured bucket   : ${bucket || "(B2_BUCKET_NAME not set)"}`);
  console.log(`toCdnUrl hard-coded : tvp-music-hls`);

  await mongoose.connect(config.mongoUri);

  const rows = await Track.find({})
    .select("status errorReason hlsUrl trackUrl updatedAt")
    .lean<Row[]>();

  const groups = new Map<string, { count: number; samples: Row[] }>();
  for (const row of rows) {
    const key = classify(row, bucket, cdnHost);
    const group = groups.get(key) ?? { count: 0, samples: [] };
    group.count += 1;
    if (group.samples.length < SAMPLES_PER_GROUP) group.samples.push(row);
    groups.set(key, group);
  }

  console.log(`\nTotal tracks: ${rows.length}\n`);
  const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, group] of sorted) {
    console.log(`${String(group.count).padStart(6)}  ${key}`);
    for (const s of group.samples) {
      const reason = s.errorReason ? ` reason="${s.errorReason.slice(0, 80)}"` : "";
      console.log(`          - ${s._id} ${s.hlsUrl ?? ""}${reason}`);
    }
  }

  await mongoose.disconnect();
}

auditHlsUrls().catch((err) => {
  console.error("HLS audit failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
  mongoose.disconnect().finally(() => process.exit(process.exitCode ?? 1));
});
