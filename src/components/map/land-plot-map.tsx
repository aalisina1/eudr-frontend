"use client";

import { useEffect, useRef, useState } from "react";
import { plotIdentity } from "@/lib/plot-identity";
import type { LandPlot, ValidationStatus } from "@/lib/api/types";
import { basemap } from "@/lib/map/basemap";

const STATUS_COLORS: Record<ValidationStatus, string> = {
  PENDING: "#C7956D",
  PASSED: "#34D399",
  FAILED: "#C23D3D",
  REQUIRES_REVIEW: "#E8C468",
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value before it is interpolated into the popup's HTML string
 * (built manually below for Leaflet's `bindPopup`, not via React). Plot
 * fields — `external_id` in particular, user-writable via PATCH since
 * ADR-0026 (eudr-app#161) — are untrusted; skipping this turns a stored
 * value like `<img src=x onerror=...>` into markup that executes for anyone
 * viewing the org's map. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

interface LandPlotMapProps {
  plots: LandPlot[];
  selectedPlotId?: string | null;
}

export function LandPlotMap({ plots, selectedPlotId }: LandPlotMapProps) {
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerMapRef = useRef<Map<string, import("leaflet").GeoJSON>>(new Map());
  // The map is created inside an async effect, so the layer effects below
  // would otherwise run once against null refs and never again for a caller
  // that already has its plots at mount (the plot detail page). Tracking
  // readiness in state re-runs them the moment the map exists.
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once (not on every plots change)
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;

      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        zoomControl: false,
      }).setView([0, 20], 3);

      mapRef.current = map;
      leafletRef.current = L;
      setMapReady(true);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
        maxZoom: basemap.maxZoom,
        subdomains: basemap.subdomains,
      }).addTo(map);

      // Ensure map tiles render correctly after container layout settles
      requestAnimationFrame(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update plot layers when data changes (without recreating the map)
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Clear existing plot layers
    for (const layer of layerMapRef.current.values()) {
      map.removeLayer(layer);
    }
    layerMapRef.current = new Map();

    const allLayers: import("leaflet").Layer[] = [];

    for (const plot of plots) {
      if (!plot.geometry) continue;

      const color = STATUS_COLORS[plot.validation_status] ?? STATUS_COLORS.PENDING;

      const layer = L.geoJSON(
        { type: "Feature", geometry: plot.geometry, properties: {} } as GeoJSON.Feature,
        {
          style: {
            color,
            weight: 2,
            fillOpacity: 0.2,
            fillColor: color,
            dashArray: plot.validation_status === "FAILED" ? "6 3" : undefined,
          },
          pointToLayer: (_, latlng) =>
            L.circleMarker(latlng, {
              radius: 7,
              color,
              fillColor: color,
              fillOpacity: 0.5,
              weight: 2,
            }),
        },
      );

      const label = plotIdentity(plot).primary;

      layer
        .bindPopup(
          `<div style="font-family: var(--font-sans); min-width: 160px;">
            <p style="font-weight: 600; font-size: 13px; margin: 0 0 6px 0; color: var(--card-foreground);">${escapeHtml(label)}</p>
            <div style="display: grid; gap: 3px; font-size: 12px; color: var(--muted-foreground);">
              <span>Area: ${escapeHtml(String(plot.area_hectares))} ha</span>
              <span>Source: ${escapeHtml(plot.geometry_source)}</span>
              ${plot.external_id ? `<span>Their code: <span style="font-family: monospace; font-size: 11px;">${escapeHtml(plot.external_id)}</span></span>` : ""}
              <span style="display: inline-flex; align-items: center; gap: 5px;">
                Status: <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
                <span style="text-transform: capitalize; color: ${color}; font-weight: 500;">${plot.validation_status.toLowerCase()}</span>
              </span>
            </div>
          </div>`,
        )
        .addTo(map);

      layerMapRef.current.set(plot.id, layer);
      allLayers.push(layer);
    }

    if (allLayers.length > 0) {
      const group = L.featureGroup(allLayers);
      const bounds = group.getBounds();

      // Deferred to the next frame, after invalidateSize().
      //
      // The map is created in an async effect, so this can run while the
      // container is still being laid out and Leaflet's cached size is still
      // 0x0. fitBounds against a zero-size viewport does not throw — it
      // silently leaves the map on the setView() default. That shipped: 18
      // plots in Ghana and Cote d'Ivoire, and a map showing the whole planet
      // with nothing on it, which reads as a broken feature rather than a
      // zoom level.
      //
      // invalidateSize() makes Leaflet re-measure the real box first; the
      // rAF guarantees layout has happened before either call.
      requestAnimationFrame(() => {
        const current = mapRef.current;
        if (!current) return;
        current.invalidateSize();
        current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      });
    }
  }, [plots, mapReady]);

  // Fly to the selected plot and open its popup
  useEffect(() => {
    if (!selectedPlotId || !mapRef.current) return;

    const layer = layerMapRef.current.get(selectedPlotId);
    if (!layer) return;

    const bounds = layer.getBounds();
    mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    layer.openPopup();
  }, [selectedPlotId, plots, mapReady]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  );
}
