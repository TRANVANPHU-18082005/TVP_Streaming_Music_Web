export interface Palette {
  hex: string;
  r: (opacity: number) => string;
  heroGradient: string;
  hslChannels: string;
  glowShadow: string;
}
export function hexToRgba(hex: string, opacity: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`
    : `rgba(139,92,246,${opacity})`;
}

export function hexToHslChannels(hex: string): string {
  hex = hex.replace(/^#/, "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function buildPalette(hex: string): Palette {
  const r = (op: number) => hexToRgba(hex, op);
  return {
    hex,
    r,
    hslChannels: hexToHslChannels(hex),
    heroGradient: `linear-gradient(180deg, ${r(0.62)} 0%, ${r(0.22)} 48%, transparent 100%)`,
    glowShadow: `0 8px 28px -6px ${r(0.55)}`,
  };
}
function colorWithOpacity(color: string, opacity: number) {
  if (color.startsWith("#")) {
    return hexToRgba(color, opacity);
  }

  if (color.startsWith("hsl")) {
    return color.replace("hsl(", "hsla(").replace(")", ` / ${opacity})`);
  }

  return color;
}
function extractHslChannels(color: string) {
  if (color.startsWith("hsl")) {
    return color.replace("hsl(", "").replace(")", "");
  }

  return hexToHslChannels(color);
}
export function buildPaletteWithColor(color: string): Palette {
  const r = (opacity: number) => colorWithOpacity(color, opacity);

  return {
    hex: color,
    r,
    hslChannels: extractHslChannels(color),

    heroGradient: `
      linear-gradient(
        180deg,
        ${r(0.62)} 0%,
        ${r(0.22)} 48%,
        transparent 100%
      )
    `,

    glowShadow: `0 8px 28px -6px ${r(0.55)}`,
  };
}
export function getCssVariable(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
export function getThemePrimary() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary")
    .trim();
}
