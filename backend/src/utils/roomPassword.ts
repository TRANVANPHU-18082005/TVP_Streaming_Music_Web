import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value: string): boolean {
  return BCRYPT_PREFIX.test(value);
}

export function hashRoomPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Only a bcrypt hash is compared, with bcrypt.compare.
 * A missing password means the room has no secret.
 * Any other stored value is legacy plaintext and fails closed.
 * `npm run migrate:room-passwords` is the one-time rehash.
 * Join does not accept or rewrite plaintext.
 */
export async function roomPasswordMatches(
  stored: string | null | undefined,
  provided: string | undefined,
): Promise<boolean> {
  if (stored == null || stored === "") {
    return provided === stored;
  }
  if (!isBcryptHash(stored) || typeof provided !== "string") return false;
  return bcrypt.compare(provided, stored);
}
