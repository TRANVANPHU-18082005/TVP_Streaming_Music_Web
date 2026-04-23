import mongoose from "mongoose";
import { sleep } from "./fs.utils";

const DB_CONNECT_RETRIES = 3;
const DB_RETRY_BASE_MS = 2_000;

/**
 * Connect to MongoDB with exponential-ish retry.
 * Throws after DB_CONNECT_RETRIES failed attempts.
 */
export async function connectWithRetry(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("[db.utils] MONGO_URI env var is not set.");

  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
      console.log("📦 Worker DB Connected");
      return;
    } catch (err) {
      const delay = DB_RETRY_BASE_MS * attempt;
      console.error(
        `❌ DB Error (attempt ${attempt}/${DB_CONNECT_RETRIES}):`,
        (err as Error).message,
      );
      if (attempt === DB_CONNECT_RETRIES) {
        throw new Error(
          `[db.utils] Failed to connect to MongoDB after ${DB_CONNECT_RETRIES} attempts.`,
        );
      }
      await sleep(delay);
    }
  }
}
