import { cacheRedis } from "../config/redis";

export const clearAlbumCache = async () => {
  const keys = await cacheRedis.keys("album:list:*");
  if (keys.length > 0) {
    await cacheRedis.del(...keys);
    console.log(`✅ Cleared ${keys.length} album cache keys`);
  }
};
export const buildCacheKey = (
  prefix: string,
  role: string,
  filter: Record<string, unknown>,
): string => {
  // Bỏ undefined/null, sort keys để stable
  const clean = Object.fromEntries(
    Object.entries(filter)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${prefix}:${role}:${JSON.stringify(clean)}`;
};

/** Wrap Redis call với timeout — tránh request treo khi Upstash chậm */
export const withCacheTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs = 2000,
): Promise<T | null> => {
  try {
    return await Promise.race([
      fn(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Cache timeout")), timeoutMs),
      ),
    ]);
  } catch {
    return null;
  }
};
