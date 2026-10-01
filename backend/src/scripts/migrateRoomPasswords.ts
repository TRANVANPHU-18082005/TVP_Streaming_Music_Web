/**
 * One-time rehash of MusicRoom passwords that are still plaintext.
 *
 * Runtime join and room lookup do not compare or rewrite plaintext.
 * Those rooms fail closed with WRONG_PASSWORD until this script runs.
 * Safe to run more than once. Rows that already start with a bcrypt
 * prefix are skipped. Does not print password values.
 *
 *   npm run migrate:room-passwords
 */
import mongoose from "mongoose";
import config from "../config/env";
import MusicRoom from "../models/MusicRoom";
import { hashRoomPassword, isBcryptHash } from "../utils/roomPassword";

async function migrateRoomPasswords(): Promise<void> {
  if (!config.mongoUri) {
    console.error("MONGO_URI is not set");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(config.mongoUri);

  const rooms = await MusicRoom.find({
    password: { $exists: true, $nin: [null, ""] },
  }).select("+password");

  let hashed = 0;
  let alreadyHashed = 0;

  for (const room of rooms) {
    const current = room.password;
    if (!current || isBcryptHash(current)) {
      alreadyHashed += 1;
      continue;
    }

    const next = await hashRoomPassword(current);
    const result = await MusicRoom.updateOne(
      { _id: room._id, password: current },
      { $set: { password: next } },
    );
    if (result.modifiedCount > 0) hashed += 1;
  }

  console.log(
    `MusicRoom passwords hashed: ${hashed}. Already hashed or empty: ${alreadyHashed}.`,
  );
  await mongoose.disconnect();
}

migrateRoomPasswords().catch(() => {
  console.error("MusicRoom password migration failed");
  process.exitCode = 1;
  mongoose.disconnect().finally(() => process.exit(process.exitCode ?? 1));
});
