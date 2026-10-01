import type { ConnectionOptions } from "tls";

/**
 * TLS for rediss:// only. Verification stays on.
 * REDIS_TLS_CA is an optional PEM (literal newlines or "\n") when the
 * provider CA is not in Node's trust store. Setting `ca` replaces the
 * default trust store, so leave it unset for public CAs such as Upstash.
 */
export function redisTlsOptions(url: string): ConnectionOptions | undefined {
  if (!url.startsWith("rediss://")) return undefined;

  const ca = process.env.REDIS_TLS_CA?.trim();
  if (!ca) return { rejectUnauthorized: true };

  return {
    rejectUnauthorized: true,
    ca: ca.replace(/\\n/g, "\n"),
  };
}
