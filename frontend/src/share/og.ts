export const SITE_NAME = "TVP Music";
export const SITE_TAGLINE = "Nghe. Cảm. Lan tỏa.";
export const SITE_DESCRIPTION = SITE_TAGLINE;

const CLOUD_NAME = "dc5rfjnn5";
const LOGO_ID = "LOGO_o4n02n";

const CRAWLER_UA =
  /facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|telegrambot|whatsapp|zalo|skypeuripreview|pinterest|embedly|iframely|vkshare|quora link preview/i;

export type EntityKind =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "genre"
  | "mashup"
  | "short"
  | "room";

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

const ROUTES: Array<{ kind: EntityKind; prefix: string; reserved: string[] }> = [
  { kind: "track", prefix: "tracks", reserved: ["history"] },
  { kind: "album", prefix: "albums", reserved: [] },
  { kind: "playlist", prefix: "playlists", reserved: ["import"] },
  { kind: "artist", prefix: "artists", reserved: [] },
  { kind: "genre", prefix: "genres", reserved: [] },
  { kind: "mashup", prefix: "mashups", reserved: ["feed", "create"] },
  { kind: "short", prefix: "shorts", reserved: ["create"] },
  { kind: "room", prefix: "rooms", reserved: [] },
];

const BADGE: Record<EntityKind, string> = {
  track: "Bài hát",
  album: "Album",
  playlist: "Playlist",
  artist: "Nghệ sĩ",
  genre: "Thể loại",
  mashup: "Mashup",
  short: "Short",
  room: "Phòng nhạc",
};

export function isCrawler(userAgent: string): boolean {
  return CRAWLER_UA.test(userAgent);
}

export function parseEntityPath(pathname: string): EntityRef | null {
  const path = safePath(pathname);
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [prefix, id] = parts;
  const route = ROUTES.find((item) => item.prefix === prefix);
  if (!route || !id || route.reserved.includes(id.toLowerCase())) return null;
  return { kind: route.kind, id };
}

export function entityApiPath(ref: EntityRef): string {
  const id = encodeURIComponent(ref.id);
  switch (ref.kind) {
    case "track":
      return `/tracks/${id}`;
    case "album":
      return `/albums/${id}`;
    case "playlist":
      return `/playlists/${id}`;
    case "artist":
      return `/artists/${id}`;
    case "genre":
      return `/genres/${id}`;
    case "mashup":
      return `/mashups/${id}`;
    case "short":
      return `/shorts/${id}`;
    case "room":
      return `/rooms/${id}`;
  }
}

export function cloudinaryPublicId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== "res.cloudinary.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== CLOUD_NAME) return null;
  const uploadAt = parts.indexOf("upload");
  if (uploadAt < 0) return null;
  let rest = parts.slice(uploadAt + 1);
  while (rest.length > 0 && isCloudinaryPrefix(rest[0])) rest = rest.slice(1);
  if (rest.length === 0) return null;
  const id = rest.join("/").replace(/\.(jpe?g|png|webp|gif|avif)$/i, "");
  if (!id || id.includes("..")) return null;
  return id;
}

export function brandedCoverUrl(
  coverUrl: string,
  lines: { badge: string; title: string; subtitle: string },
): string | null {
  const publicId = cloudinaryPublicId(coverUrl);
  const title = cloudinaryText(lines.title, 22);
  if (!publicId || !title) return null;
  const badge = cloudinaryText(lines.badge, 16);
  const subtitle = cloudinaryText(lines.subtitle, 32);
  const layers = [
    "c_fill,g_auto,w_460,h_460,r_24",
    "c_mpad,w_1200,h_630,b_rgb:0A0614,g_west,x_64",
    `l_${LOGO_ID},w_72,c_fit,g_north_east,x_44,y_40`,
  ];
  if (badge) {
    layers.push(
      `l_text:Roboto_22_bold:${badge},co_rgb:F5C84C,g_north_west,x_600,y_200`,
    );
  }
  layers.push(
    `l_text:Roboto_44_bold:${title},co_rgb:FFFFFF,g_north_west,x_600,y_246`,
  );
  if (subtitle) {
    layers.push(
      `l_text:Roboto_26:${subtitle},co_rgb:D6D0E4,g_north_west,x_600,y_314`,
    );
  }
  layers.push("f_jpg,q_auto");
  const idPath = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${layers.join("/")}/${idPath}.jpg`;
}

export async function resolveShareHtml(input: {
  origin: string;
  pathname: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const origin = input.origin.replace(/\/$/, "");
  const pagePath = safePath(input.pathname);
  const pageUrl = `${origin}${pagePath}`;
  const site = siteCard(origin);
  const ref = parseEntityPath(pagePath);
  if (!ref) return renderHtml(pageUrl, site);

  const data = await fetchEntity(
    input.apiBase.replace(/\/$/, ""),
    entityApiPath(ref),
    input.fetchImpl ?? fetch,
  );
  const card = data ? toCard(ref.kind, data, origin) : null;
  return renderHtml(pageUrl, card ?? site);
}

function siteCard(origin: string): ShareCard {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    image: `${origin}/og/site.jpg`,
    imageAlt: SITE_NAME,
    width: 1200,
    height: 630,
  };
}

interface ShareCard {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  width?: number;
  height?: number;
}

function toCard(
  kind: EntityKind,
  data: Record<string, unknown>,
  origin: string,
): ShareCard | null {
  if (!isShareable(kind, data)) return null;
  const fields = fieldsFor(kind, data);
  if (!fields) return null;
  const title = clip(fields.title, 80);
  const subtitle = clip(fields.subtitle, 80);
  const description = subtitle ? `${subtitle} · ${SITE_NAME}` : `${BADGE[kind]} · ${SITE_NAME}`;
  const image = pickImage(origin, fields.cover, {
    badge: BADGE[kind],
    title,
    subtitle: subtitle || SITE_NAME,
  });
  return {
    title,
    description: clip(description, 120),
    image: image.url,
    imageAlt: title,
    width: image.width,
    height: image.height,
  };
}

function isShareable(kind: EntityKind, data: Record<string, unknown>): boolean {
  if (kind === "playlist") {
    const visibility = text(data.visibility);
    return visibility === "public" || visibility === "unlisted";
  }
  if (kind === "room") return data.isPublic === true;
  if (kind === "mashup" || kind === "short") return data.isPublished !== false;
  if (data.isPublic === false) return false;
  return true;
}

function fieldsFor(
  kind: EntityKind,
  data: Record<string, unknown>,
): { title: string; subtitle: string; cover: string } | null {
  if (kind === "track") {
    const title = text(data.title);
    if (!title) return null;
    return {
      title,
      subtitle: personName(data.artist),
      cover: httpUrl(data.coverImage),
    };
  }
  if (kind === "album") {
    const title = text(data.title);
    if (!title) return null;
    return {
      title,
      subtitle: personName(data.artist),
      cover: httpUrl(data.coverImage),
    };
  }
  if (kind === "playlist") {
    const title = text(data.title);
    if (!title) return null;
    return {
      title,
      subtitle: personName(data.user),
      cover: httpUrl(data.coverImage),
    };
  }
  if (kind === "artist") {
    const title = text(data.name);
    if (!title) return null;
    return {
      title,
      subtitle: "",
      cover: httpUrl(data.avatar) || httpUrl(data.coverImage),
    };
  }
  if (kind === "genre") {
    const title = text(data.name);
    if (!title) return null;
    return { title, subtitle: "", cover: httpUrl(data.image) };
  }
  if (kind === "mashup") {
    const title = text(data.title);
    if (!title) return null;
    return {
      title,
      subtitle: personName(data.createdBy),
      cover: httpUrl(data.coverImage),
    };
  }
  if (kind === "short") {
    const track = record(data.track);
    const title = text(data.title) || (track ? text(track.title) : "");
    if (!title) return null;
    const mood = record(data.moodVideo);
    return {
      title,
      subtitle: track ? personName(track.artist) : "",
      cover:
        (track ? httpUrl(track.coverImage) : "") ||
        (mood ? httpUrl(mood.thumbnailUrl) : ""),
    };
  }
  const title = text(data.name);
  if (!title) return null;
  const current = record(data.currentTrack);
  return {
    title,
    subtitle: personName(data.host),
    cover: httpUrl(data.coverImage) || (current ? httpUrl(current.coverImage) : ""),
  };
}

function pickImage(
  origin: string,
  cover: string,
  lines: { badge: string; title: string; subtitle: string },
): { url: string; width?: number; height?: number } {
  const branded = cover ? brandedCoverUrl(cover, lines) : null;
  if (branded) return { url: branded, width: 1200, height: 630 };
  if (cover) return { url: cover };
  return { url: `${origin}/og/site.jpg`, width: 1200, height: 630 };
}

async function fetchEntity(
  apiBase: string,
  apiPath: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchImpl(`${apiBase}${apiPath}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: unknown };
    if (!body || body.success === false) return null;
    return record(body.data);
  } catch {
    return null;
  }
}

function renderHtml(pageUrl: string, card: ShareCard): string {
  const title = escapeHtml(card.title);
  const description = escapeHtml(card.description);
  const image = escapeHtml(card.image);
  const alt = escapeHtml(card.imageAlt);
  const url = escapeHtml(pageUrl);
  const size =
    card.width && card.height
      ? `<meta property="og:image:width" content="${card.width}" />\n<meta property="og:image:height" content="${card.height}" />`
      : "";
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="theme-color" content="#0A0614" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="vi_VN" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:alt" content="${alt}" />
${size}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>
<p><a href="${url}">${title}</a></p>
<noscript><a href="${url}">${SITE_NAME}</a></noscript>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("..")) {
    return "/";
  }
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isCloudinaryPrefix(segment: string): boolean {
  if (/^v\d+$/.test(segment)) return true;
  return segment.split(",").every((part) => /^[a-z]{1,2}_/.test(part));
}

function cloudinaryText(value: string, max: number): string {
  const clean = clip(value, max)
    .replace(/[,/\\:?#&=%'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? encodeURIComponent(clean) : "";
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function httpUrl(value: unknown): string {
  const url = text(value);
  return url.startsWith("https://") || url.startsWith("http://") ? url : "";
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function personName(value: unknown): string {
  const person = record(value);
  if (!person) return "";
  return text(person.name) || text(person.fullName) || text(person.username);
}
