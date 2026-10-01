export type HttpLogFormat = "combined" | "dev";

/** Production access logs use Apache combined. Development stays on morgan dev. */
export function httpLogFormat(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): HttpLogFormat {
  return nodeEnv === "production" ? "combined" : "dev";
}
