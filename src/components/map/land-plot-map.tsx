"use client";

import { useEffect, useRef } from "react";
import type { LandPlot, ValidationStatus } from "@/lib/api/types";

const STATUS_COLORS: Record<ValidationStatus, string> = {
  PENDING: "#C7956D",
  PASSED: "#34D399",
  FAILED: "#C23D3D",
  REQUIRES_REVIEW: "#E8C468",
};

interface LandPlotMapProps {
  plots: LandPlot[];
  selectedPlotId?: string | null;
}

export function LandPlotMap({ plots, selectedPlotId }: LandPlotMapProps) {
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerMapRef = useRef<Map<string, import("leaflet").GeoJSON>>(new Map());

  // Initialize map and render plot layers
  useEffect(() => {
    let cancelled = false;

    async function init() {
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

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
      }).setView([0, 20], 3);

      mapRef.current = map;
      layerMapRef.current = new Map();

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

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

        const label = `${plot.country}${plot.region ? `, ${plot.region}` : ""}`;

        layer
          .bindPopup(
            `<div style="font-family: var(--font-sans); min-width: 160px;">
              <p style="font-weight: 600; font-size: 13px; margin: 0 0 6px 0; color: var(--card-foreground);">${label}</p>
              <div style="display: grid; gap: 3px; font-size: 12px; color: var(--muted-foreground);">
                <span>Area: ${plot.area_hectares} ha</span>
                <span>Source: ${plot.geometry_source}</span>
                ${plot.external_id ? `<span>ID: <span style="font-family: monospace; font-size: 11px;">${plot.external_id}</span></span>` : ""}
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
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
      }

      // Ensure map tiles render correctly after container layout settles
      setTimeout(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [plots]);

  // Fly to the selected plot and open its popup
  useEffect(() => {
    if (!selectedPlotId || !mapRef.current) return;

    const layer = layerMapRef.current.get(selectedPlotId);
    if (!layer) return;

    const bounds = layer.getBounds();
    mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    layer.openPopup();
  }, [selectedPlotId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  );
}
