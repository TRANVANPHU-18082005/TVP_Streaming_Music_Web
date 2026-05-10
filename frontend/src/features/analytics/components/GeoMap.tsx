// features/analytics/components/GeoMap.tsx

import React, { useMemo, memo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Graticule,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { GeoLocation } from "@/features/analytics/types";
import { ISO_MAPPING } from "@/utils/isoMapping";

const GEO_URL = "/world-countries.json";

/* ── Color ramp — dùng brand token từ design system ─────────────
   Light: gray-200 → brand-500 (violet-indigo)
   Dark:  brand-800 (very dark) → brand-500 (luminous violet)
   Hardcode vì SVG fill không đọc được CSS variables trực tiếp.     */
const COLOR_RAMP = {
  light: {
    empty: "#E2E4EC", // gần với --surface-3 light
    low: "#C4C8F0",
    mid: "#8B82E0",
    high: "#6355D0", // ~ brand-600
    hover: "#F59E0B", // wave-4 amber
    pressed: "#D97706",
    stroke: "#F8F9FC", // ~ background light
  },
  dark: {
    empty: "#1E2035", // ~ surface-2 dark
    low: "#2D2B5A",
    mid: "#5246B8",
    high: "#8B7CE8", // ~ brand-500 dark (luminous)
    hover: "#F59E0B",
    pressed: "#D97706",
    stroke: "#0F1020", // ~ background dark
  },
};

interface GeoMapProps {
  data: GeoLocation[];
  isDark?: boolean;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  value: number;
}

const GeoMap = ({ data, isDark = false }: GeoMapProps) => {
  const colors = isDark ? COLOR_RAMP.dark : COLOR_RAMP.light;
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: "",
    value: 0,
  });
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);

  // Build lookup map ISO2 → value
  // Trong GeoMap.tsx
  const dataMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const numericId = ISO_MAPPING[item.id] || item.id;
      map[numericId] = item.value;
    });
    return map;
  }, [data]);

  // Color scale: 4-stop quantile-ish
  const colorScale = useMemo(() => {
    const values = data?.map((d) => d.value) || [0];
    const maxVal = Math.max(...values, 0);
    return scaleLinear<string>()
      .domain([0, maxVal * 0.25, maxVal * 0.65, maxVal || 1])
      .range([colors.low, colors.mid, colors.high, colors.high])
      .clamp(true);
  }, [data, colors]);

  const getFill = useCallback(
    (countryCode: string) => {
      const v = dataMap[countryCode];
      if (!v) return colors.empty;
      return colorScale(v);
    },
    [dataMap, colorScale, colors],
  );

  const maxVal = Math.max(...(data?.map((d) => d.value) || [0]), 1);

  // Tooltip handlers
  const handleMouseEnter = useCallback(
    (geo: any, evt: React.MouseEvent<SVGPathElement>) => {
      const rect = (
        evt.currentTarget.closest("svg") as SVGElement
      ).getBoundingClientRect();
      setHoveredGeo(geo.id);
      setTooltip({
        visible: true,
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
        name: geo.properties?.name || "Unknown",
        value: dataMap[geo.id] || 0,
      });
    },
    [dataMap],
  );

  const handleMouseMove = useCallback(
    (evt: React.MouseEvent<SVGPathElement>) => {
      const rect = (
        evt.currentTarget.closest("svg") as SVGElement
      ).getBoundingClientRect();
      setTooltip((prev) => ({
        ...prev,
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      }));
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredGeo(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 155 }}
        className="w-full h-full"
        style={{ background: "transparent" }}
      >
        <ZoomableGroup
          zoom={1}
          minZoom={0.9}
          maxZoom={5}
          translateExtent={[
            [-200, -100],
            [1000, 600],
          ]}
        >
          <Graticule
            stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}
            strokeWidth={0.4}
          />

          <Geographies geography={GEO_URL}>
            {(args: any) =>
              (args.geographies as any[]).map((geo: any) => {
                const geoIdentifier =
                  geo.id || geo.properties?.ISO_A3 || geo.properties?.iso_a3;
                const isHovered = hoveredGeo === geo.id;
                const value = dataMap[geo.id] || 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isHovered ? colors.hover : getFill(geoIdentifier)}
                    stroke={colors.stroke}
                    strokeWidth={isHovered ? 0.8 : 0.4}
                    onMouseEnter={(e: React.MouseEvent<SVGPathElement>) =>
                      handleMouseEnter(geo, e)
                    }
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: {
                        outline: "none",
                        transition: "fill 0.18s ease, stroke-width 0.12s ease",
                        cursor: value > 0 ? "pointer" : "default",
                        filter:
                          isHovered && value > 0
                            ? "brightness(1.12) drop-shadow(0 2px 6px rgba(245,158,11,0.35))"
                            : "none",
                      },
                      hover: { outline: "none" },
                      pressed: { outline: "none", fill: colors.pressed },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* ── Custom Tooltip ─────────────────────────────────────── */}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-50 px-3 py-2 rounded-xl text-xs font-medium
            bg-popover/95 border border-border text-popover-foreground
            shadow-floating backdrop-blur-md whitespace-nowrap
            transition-opacity duration-100"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 38,
          }}
        >
          <div className="font-semibold text-foreground mb-0.5">
            {tooltip.name}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary inline-block" />
            {tooltip.value > 0
              ? `${tooltip.value.toLocaleString()} users`
              : "No data"}
          </div>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────── */}
      <div
        className="absolute bottom-3 left-3 flex flex-col gap-2
          bg-card/90 backdrop-blur-md border border-border/60
          rounded-xl px-3 py-2.5 shadow-card"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          User density
        </span>
        {/* Gradient bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/70 tabular-nums w-3 text-right">
            0
          </span>
          <div
            className="h-2 w-24 rounded-full"
            style={{
              background: `linear-gradient(to right, ${colors.empty}, ${colors.low}, ${colors.mid}, ${colors.high})`,
            }}
          />
          <span className="text-[9px] text-muted-foreground/70 tabular-nums">
            {maxVal >= 1000 ? `${Math.round(maxVal / 1000)}k` : maxVal}
          </span>
        </div>
        {/* Hover hint */}
        <p className="text-[9px] text-muted-foreground/50 leading-none">
          Hover to inspect · Scroll to zoom
        </p>
      </div>
    </div>
  );
};

export default memo(GeoMap);
