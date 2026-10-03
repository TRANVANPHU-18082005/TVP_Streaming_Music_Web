import Hls from "hls.js";

export type HlsProfileName = "catalog" | "prefetch" | "highlight" | "room";

type HlsOptions = ConstructorParameters<typeof Hls>[0];

const networkRetry = {
  manifestLoadingTimeOut: 20_000,
  manifestLoadingMaxRetry: 6,
  levelLoadingMaxRetry: 6,
  fragLoadingMaxRetry: 6,
} as const;

/**
 * Playlist URLs from the CDN may include a query string. Match the path, not the raw URL.
 */
export function isHlsSource(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? "";
  return path.endsWith(".m3u8");
}

export function createHls(profile: HlsProfileName, extra?: HlsOptions): Hls {
  switch (profile) {
    case "catalog":
      return new Hls({
        ...networkRetry,
        maxBufferLength: 30,
        maxMaxBufferLength: 90,
        backBufferLength: 30,
        enableWorker: true,
        startFragPrefetch: true,
        highBufferWatchdogPeriod: 3,
        nudgeMaxRetry: 10,
        abrEwmaDefaultEstimate: 500_000,
        testBandwidth: false,
        ...extra,
      });
    case "prefetch":
      return new Hls({
        ...networkRetry,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 0,
        enableWorker: true,
        startFragPrefetch: true,
        autoStartLoad: true,
        ...extra,
      });
    case "highlight":
      return new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 15,
        enableWorker: true,
        autoStartLoad: false,
        ...extra,
      });
    case "room":
      return new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 15,
        enableWorker: true,
        manifestLoadingTimeOut: 20_000,
        manifestLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4,
        ...extra,
      });
    default: {
      const unreachable: never = profile;
      return unreachable;
    }
  }
}

/** After a prefetch instance is moved onto the audible element, raise it to the catalog cap. */
export function promotePrefetchToCatalog(hls: Hls): void {
  hls.config.maxBufferLength = 30;
  hls.config.maxMaxBufferLength = 90;
  hls.config.backBufferLength = 30;
}
