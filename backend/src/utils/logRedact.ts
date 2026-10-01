const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|otp|credential|apikey|api[_-]?key|emailpass/i;

/** Whole-key match so `errorCode` stays visible while OAuth `code` does not. */
const EXACT_SENSITIVE_KEY = /^(code|oauthcode|authcode|verificationcode)$/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key) || EXACT_SENSITIVE_KEY.test(key);
}

const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const QUERY_SECRET =
  /((?:access_token|refresh_token|id_token|token|password|passwd|otp|code|client_secret)=)[^&\s]+/gi;

export function redactString(value: string): string {
  return value
    .replace(BEARER, "Bearer [Redacted]")
    .replace(JWT, "[Redacted]")
    .replace(QUERY_SECRET, "$1[Redacted]");
}

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[Truncated]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    const extra: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      extra[key] = (value as unknown as Record<string, unknown>)[key];
    }
    return redactLogValue(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
        ...extra,
      },
      depth + 1,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[key] = isSensitiveKey(key)
        ? "[Redacted]"
        : redactLogValue(nested, depth + 1);
    }
    return output;
  }
  return value;
}
