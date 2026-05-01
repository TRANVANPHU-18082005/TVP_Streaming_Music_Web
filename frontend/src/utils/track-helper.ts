import { env } from "@/config/env";

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
const FALLBACK_COLOR = "primary";

export async function extractDominantColor(imageUrl?: string): Promise<string> {
  if (!imageUrl) return FALLBACK_COLOR;

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const settle = (color: string) => {
      if (settled) return;
      settled = true;
      resolve(color);
    };

    // Timeout phòng ảnh load quá lâu
    const timer = setTimeout(() => settle(FALLBACK_COLOR), 5000);

    img.crossOrigin = "anonymous";

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 40;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          settle(FALLBACK_COLOR);
          return;
        }

        ctx.drawImage(img, 0, 0, 40, 40);

        // Sẽ throw SecurityError nếu CORS không được phép
        const data = ctx.getImageData(0, 0, 40, 40).data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 20 && brightness < 220) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        if (!count) {
          settle(FALLBACK_COLOR);
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        // Lightness — darken xuống ≤40% để dùng làm background
        const l = Math.round(((max + min) / 2 / 255) * 100 * 0.4);

        // Saturation — giảm 30% để không quá chói
        const s =
          delta === 0
            ? 0
            : Math.round(
                (delta / (255 - Math.abs(max + min - 255))) * 60 * 0.7,
              );

        // Hue
        let h = 0;
        if (delta !== 0) {
          if (max === r) h = (((g - b) / delta) * 60 + 360) % 360;
          else if (max === g) h = ((b - r) / delta) * 60 + 120;
          else h = ((r - g) / delta) * 60 + 240;
        }

        settle(`hsl(${Math.round(h)} ${s}% ${l}%)`);
      } catch {
        // CORS bị block → canvas tainted → getImageData throw
        // Fallback im lặng, không crash app
        settle(FALLBACK_COLOR);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      settle(FALLBACK_COLOR);
    };

    img.src = imageUrl;
  });
}
const CDN_DOMAIN = env.CDN_DOMAIN;

export const toCDN = (url?: string) => {
  if (!url) return url;

  // ✅ Case 1: bucket.subdomain (PHẢI để lên trước)
  if (url.includes(".s3.ca-east-006.backblazeb2.com")) {
    const [prefix, path] = url.split(".s3.ca-east-006.backblazeb2.com");
    const bucket = prefix.replace("https://", "");

    return `${CDN_DOMAIN}/file/${bucket}${path}`;
  }

  // Case 2: s3 dạng chuẩn
  if (url.includes("s3.ca-east-006.backblazeb2.com")) {
    return url.replace(
      "https://s3.ca-east-006.backblazeb2.com",
      CDN_DOMAIN + "/file",
    );
  }

  // Case 3: f006
  if (url.includes("f006.backblazeb2.com")) {
    return url.replace("https://f006.backblazeb2.com", CDN_DOMAIN);
  }

  return url;
};
