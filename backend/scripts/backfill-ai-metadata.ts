import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

import Track from "../src/models/Track";
import aiService from "../src/services/ai/ai.service";
import { connectWithRetry } from "../src/utils/db.utils";
import os from "os";

// Helper function to delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("Starting backfill for AI Metadata...");
  await connectWithRetry();

  const tracksToAnalyze = await Track.find({
    "aiMetadata.analyzedAt": { $exists: false },
    status: "ready",
    isDeleted: false
  }).select("_id title artist");

  console.log(`Found ${tracksToAnalyze.length} tracks to analyze.`);

  for (let i = 0; i < tracksToAnalyze.length; i++) {
    const track = tracksToAnalyze[i];
    console.log(`[${i + 1}/${tracksToAnalyze.length}] Analyzing track: ${track.title} (${track._id})`);
    
    try {
      await aiService.analyzeTrack(track._id.toString());
      console.log(`✅ Success for ${track._id}`);
      
      // Delay to respect Gemini API rate limits (e.g. 15 RPM for free, but Pro might be higher, still good practice)
      // 2000ms delay to be safe
      await delay(2000);
    } catch (err: any) {
      console.error(`❌ Failed for ${track._id}:`, err.message);
      // Wait a bit longer if failed (maybe rate limit)
      await delay(5000);
    }
  }

  console.log("Backfill completed!");
  process.exit(0);
}

main().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
