import { toast } from "sonner";

export function buildShareUrl(path: string): string {
  const trimmed = path.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const safe = withSlash.startsWith("//") ? "/" : withSlash;
  return `${window.location.origin}${safe}`;
}

export type ShareResult = "shared" | "copied" | "dismissed";

export async function shareOrCopy(input: {
  title: string;
  text?: string;
  url: string;
}): Promise<ShareResult> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({
        title: input.title,
        url: input.url,
        ...(input.text ? { text: input.text } : {}),
      });
      return "shared";
    }
  } catch (error) {
    if (isAbort(error)) return "dismissed";
  }

  try {
    await navigator.clipboard.writeText(input.url);
    toast.success("Đã chép liên kết");
    return "copied";
  } catch {
    return "dismissed";
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}
