/**
 * Point the existing PlayLog TTL index at 30 days.
 *
 * Mongoose does not change expireAfterSeconds on an index that already
 * exists. This script does. Safe to run more than once. It does not
 * delete documents. Listens the old 8-day TTL already removed stay gone.
 *
 *   npm run migrate:playlog-ttl
 */
import mongoose from "mongoose";
import config from "../config/env";
import PlayLog, {
  findPlayLogTtlIndex,
  PLAY_LOG_TTL_SECONDS,
} from "../models/PlayLog";

async function migratePlayLogTtl(): Promise<void> {
  if (!config.mongoUri) {
    console.error("MONGO_URI is not set");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(config.mongoUri);

  const collection = PlayLog.collection;
  const indexes = (await collection.indexes()).map((index) => ({
    key: index.key as Record<string, number>,
    name: index.name,
    expireAfterSeconds: index.expireAfterSeconds,
  }));
  const current = findPlayLogTtlIndex(indexes);

  if (!current) {
    await collection.createIndex(
      { listenedAt: 1 },
      { expireAfterSeconds: PLAY_LOG_TTL_SECONDS },
    );
    console.log(`PlayLog TTL index created at ${PLAY_LOG_TTL_SECONDS} seconds.`);
    await mongoose.disconnect();
    return;
  }

  if (current.expireAfterSeconds === PLAY_LOG_TTL_SECONDS) {
    console.log(`PlayLog TTL already ${PLAY_LOG_TTL_SECONDS} seconds.`);
    await mongoose.disconnect();
    return;
  }

  const previous = current.expireAfterSeconds;
  await mongoose.connection.db!.command({
    collMod: collection.collectionName,
    index: {
      name: current.name,
      expireAfterSeconds: PLAY_LOG_TTL_SECONDS,
    },
  });
  console.log(
    `PlayLog TTL expireAfterSeconds: ${previous} -> ${PLAY_LOG_TTL_SECONDS}.`,
  );
  await mongoose.disconnect();
}

migratePlayLogTtl().catch(() => {
  console.error("PlayLog TTL migration failed");
  process.exitCode = 1;
  mongoose.disconnect().finally(() => process.exit(process.exitCode ?? 1));
});
