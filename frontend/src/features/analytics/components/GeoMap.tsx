// features/analytics/components/GeoMap.tsx

import React, { useMemo, memo, useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scaleLinear } from "d3-scale";
import { GeoLocation } from "@/features/analytics/types";
import { ISO_MAPPING } from "@/utils/isoMapping";
import { feature } from "topojson-client";
const GEO_URL = "../../../../public/world-countries.json";
console.log("GEO_URL:", GEO_URL);
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
  const [geoJson, setGeoJson] = useState<any | null>(null);
  console.log(geoJson,data);
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
  // Leaflet event handlers will update tooltip state
  const handleFeatureMouseOver = useCallback(
    (feature: any, layer: L.Layer, evt: any) => {
      const id =
        feature.id || feature.properties?.ISO_A3 || feature.properties?.iso_a3;
      setHoveredGeo(id);
      const name =
        feature.properties?.name || feature.properties?.NAME || "Unknown";
      const value = dataMap[id] || 0;
      // use container point for tooltip offset
      const containerPoint = evt?.containerPoint;
      setTooltip({
        visible: true,
        x: containerPoint ? containerPoint.x : 0,
        y: containerPoint ? containerPoint.y : 0,
        name,
        value,
      });
      // subtle highlight
      (layer as any).setStyle?.({ weight: 0.8 });
    },
    [dataMap],
  );

  const handleFeatureMouseMove = useCallback((evt: any) => {
    const p = evt.containerPoint;
    setTooltip((prev) => ({ ...prev, x: p.x, y: p.y }));
  }, []);

  const handleFeatureMouseOut = useCallback((feature: any, layer: L.Layer) => {
    setHoveredGeo(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
    (layer as any).setStyle?.({ weight: 0.4 });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(GEO_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }

        return r.json();
      })
      .then((topology) => {
        const objectKey = Object.keys(topology.objects)[0];

        const geo = feature(topology, topology.objects[objectKey]);

        if (!cancelled) {
          setGeoJson(geo);
        }
      })
      .catch((err) => {
        console.error("GeoJSON load failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={1}
        style={{ width: "100%", height: "100%" }}
        worldCopyJump={false}
        attributionControl={false}
      >
        {/* Use minimal basemap for context; TileLayer can be removed if undesired */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {geoJson && (
          <GeoJSON
            data={geoJson}
            style={(feature: any) => {
              const id =
                feature.id ||
                feature.properties?.ISO_A3 ||
                feature.properties?.iso_a3 ||
                feature.properties?.ISO_A2 ||
                feature.properties?.iso_a2;
              const fill = hoveredGeo === id ? colors.hover : getFill(id);
              return {
                color: colors.stroke,
                weight: hoveredGeo === id ? 0.8 : 0.4,
                fillColor: fill,
                fillOpacity: 1,
                dashArray: "",
              } as any;
            }}
            onEachFeature={(feature: any, layer: any) => {
              layer.on({
                mouseover: (e: any) =>
                  handleFeatureMouseOver(feature, layer, e),
                mousemove: (e: any) => handleFeatureMouseMove(e),
                mouseout: () => handleFeatureMouseOut(feature, layer),
              });
            }}
          />
        )}
      </MapContainer>

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
