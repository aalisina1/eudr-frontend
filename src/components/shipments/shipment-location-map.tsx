"use client";

import { useEffect, useRef } from "react";
import { humanizeEventType } from "@/lib/consignment-format";
import { formatEta } from "@/lib/readiness-format";
import type { ConsignmentLocation } from "@/lib/api/types";

interface ShipmentLocationMapProps {
  location: ConsignmentLocation | null;
}

/** Detail-page location map + readout (ADR-0025). Follows the house
 * manual-Leaflet pattern in `src/components/map/land-plot-map.tsx` (dynamic
 * `await import("leaflet")`, container ref, CartoCDN voyager tiles,
 * requestAnimationFrame invalidateSize, cleanup on unmount). Degrades to a
 * muted "No location yet" card body when `location` is null — the field is
 * optional-additive and null for untracked consignments. */
export function ShipmentLocationMap({ location }: ShipmentLocationMapProps) {
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!location) return;
    // Bind to a local const: TS narrowing of a destructured prop doesn't
    // survive into the nested async closure below.
    const loc = location;
    let cancelled = false;

    async function initMap() {
      const container = containerRef.current;
      if (!container) return;

      // Guard: a zero-size container (jsdom in tests, or a hidden/unlaid-out
      // container) means Leaflet has nothing real to measure into — no-op
      // instead of calling into leaflet, which keeps this component safe to
      // mount in jsdom without ever touching the leaflet module.
      if (container.clientWidth === 0 || container.clientHeight === 0) return;

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
      }).setView([loc.latitude, loc.longitude], 5);

      mapRef.current = map;

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

      L.marker([loc.latitude, loc.longitude]).addTo(map);

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
    };
  }, [location]);

  if (!location) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-secondary/30 px-4 py-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">No location yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Set a tracking number to follow this shipment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-xl" />
      <p className="text-sm">
        <span className="font-medium text-foreground">Currently at {location.name}</span>{" "}
        <span className="text-muted-foreground">
          · {humanizeEventType(location.event_type)} · {formatEta(location.occurred_at)}
        </span>
      </p>
    </div>
  );
}
