declare namespace NodeJS {
  // Treat Timeout as any in browser environment to satisfy refs
  type Timeout = any;
}

interface Window {
  YT: any;
  onYouTubeIframeAPIReady: () => void;
}
