export function useTitleStyle(title: string): {
  className: string;
  style: React.CSSProperties;
} {
  const len = title.length;
  const base: React.CSSProperties = {
    lineHeight: 1.18,
    paddingBottom: "0.1em",
    overflow: "visible",
  };

  if (len > 40) {
    return {
      className: "text-xl sm:text-2xl md:text-3xl lg:text-4xl",
      style: base,
    };
  }
  if (len > 22) {
    return {
      className: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl",
      style: base,
    };
  }
  if (len > 12) {
    return {
      className: "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
      style: base,
    };
  }
  return {
    className: "font-black",
    style: { ...base, fontSize: "clamp(2.6rem, 8vw, 6.5rem)" },
  };
}
