import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShipmentLocationMap } from "@/components/shipments/shipment-location-map";
import type { ConsignmentLocation } from "@/lib/api/types";

// jsdom can't lay out or size a Leaflet map (no real canvas/tiles), so this
// only proves the readout + the null-degrade — the house pattern's actual
// map init is guarded off in jsdom (see component: zero-size container
// no-ops instead of calling into leaflet). E2E covers the real map render.
function location(over: Partial<ConsignmentLocation> = {}): ConsignmentLocation {
  return {
    locode: "NLRTM",
    name: "Rotterdam",
    latitude: 51.9225,
    longitude: 4.47917,
    event_type: "port_arrival",
    occurred_at: "2026-07-21T09:00:00Z",
    ...over,
  };
}

describe("<ShipmentLocationMap />", () => {
  it("renders the 'Currently at' readout with humanized event + short date for a resolved location", () => {
    render(<ShipmentLocationMap location={location()} />);
    expect(screen.getByText(/Currently at Rotterdam/)).toBeInTheDocument();
    expect(screen.getByText(/Port arrival/)).toBeInTheDocument();
    expect(screen.getByText(/21 Jul/)).toBeInTheDocument();
  });

  it("degrades to 'No location yet' with no map when location is null", () => {
    render(<ShipmentLocationMap location={null} />);
    expect(screen.getByText("No location yet")).toBeInTheDocument();
    expect(screen.getByText(/Set a tracking number to follow this shipment/)).toBeInTheDocument();
    expect(screen.queryByText(/Currently at/)).not.toBeInTheDocument();
  });

  it("does not throw when mounted in a zero-size (jsdom) container", () => {
    expect(() => render(<ShipmentLocationMap location={location()} />)).not.toThrow();
  });
});
