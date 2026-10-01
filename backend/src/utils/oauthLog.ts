type OAuthQuery = {
  error?: unknown;
  code?: unknown;
} | null | undefined;

/** Callback audit fields. The authorization code stays out of the log. */
export function oauthCallbackLogFields(query: OAuthQuery): { hasError: boolean } {
  return { hasError: Boolean(query?.error) };
}

/**
 * Provider error name only. Values that are not a short error code
 * (an authorization code, a token, a description) are not logged.
 */
export function oauthProviderErrorFields(query: OAuthQuery): { error: string } {
  const error = query?.error;
  if (typeof error === "string" && /^[a-z0-9_]+$/i.test(error)) {
    return { error };
  }
  return { error: "provider_error" };
}
