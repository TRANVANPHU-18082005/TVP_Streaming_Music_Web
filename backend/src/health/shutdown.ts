type ForceExitTimer = {
  unref: () => void;
};

export type StartupShutdown = {
  exit: (code: number) => void;
  closeServer: (onClosed: () => void) => void;
  forceExitMs?: number;
  schedule?: (callback: () => void, delayMs: number) => ForceExitTimer;
};

/**
 * Route mounting or infra connect failed after listen.
 * Close the HTTP server, then exit so Fly.io can restart the machine.
 * If close does not return, exit anyway.
 */
export function terminateAfterStartupFailure(options: StartupShutdown): void {
  const forceExitMs = options.forceExitMs ?? 5_000;
  const schedule =
    options.schedule ??
    ((callback, delayMs) => {
      const timer = setTimeout(callback, delayMs);
      return { unref: () => timer.unref() };
    });

  schedule(() => options.exit(1), forceExitMs).unref();
  options.closeServer(() => options.exit(1));
}
