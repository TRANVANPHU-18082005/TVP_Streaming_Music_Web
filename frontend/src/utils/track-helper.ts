// utils/track-helper.ts
export const formatDuration = (seconds: number | undefined): string => {
  if (!seconds || isNaN(seconds)) return "--:--";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
};
export const formatDate = (data: string): string => {
  let formattedDate = "";
  try {
    formattedDate = data
      ? new Date(data).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
  } catch {
    formattedDate = new Date().toISOString().split("T")[0];
  }
  return formattedDate;
};

export const STATUS_CONFIG = {
  ready: {
    label: "Ready",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    animate: false,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    animate: true,
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    animate: false,
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    animate: false,
  },
} as const;
export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}
