/** Listen audit fields. Identity and IP stay in PlayLog, not in the log line. */
export function listenAuditFields(input: {
  trackId: string;
  userId?: string | null;
  ip?: string;
}) {
  return {
    trackId: input.trackId,
    guest: !input.userId,
  };
}

export function workerErrorFields(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : "listen job failed",
  };
}
