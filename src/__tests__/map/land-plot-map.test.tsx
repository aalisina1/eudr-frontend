/**
 * `LandPlotMap` builds its popup as a hand-rolled HTML string passed to
 * Leaflet's `bindPopup` (not React), so it can't be exercised through normal
 * DOM queries. jsdom also can't lay out/size a real Leaflet map (see the
 * sibling pattern in `shipment-location-map.test.tsx`). Rather than fall back
 * to testing only the extracted `escapeHtml` helper in isolation, this file
 * mocks the `leaflet` module itself (map/layer/tileLayer/etc. as `vi.fn()`
 * stubs) so the component's real effects run end-to-end and we can inspect
 * the exact HTML string handed to `bindPopup` — covering both the popup
 * heading (ADR-0026 identity, #83) and the HTML-escaping of untrusted plot
 * fields (stored-XSS fix, `external_id` became PATCH-writable in
 * eudr-app#161).
 */
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { LandPlotMap, escapeHtml } from "@/components/map/land-plot-map";
import type { LandPlot } from "@/lib/api/types";

vi.mock("leaflet", () => {
  const mapInstance = {
    setView: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
  };
  mapInstance.setView.mockReturnValue(mapInstance);

  const layer = {
    getBounds: vi.fn(() => ({})),
    openPopup: vi.fn(),
    addTo: vi.fn(),
    bindPopup: vi.fn(),
  };
  layer.addTo.mockReturnValue(layer);
  layer.bindPopup.mockReturnValue(layer);

  const L = {
    map: vi.fn(() => mapInstance),
    control: { zoom: vi.fn(() => ({ addTo: vi.fn() })) },
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    geoJSON: vi.fn(() => layer),
    circleMarker: vi.fn(() => ({})),
    featureGroup: vi.fn(() => ({ getBounds: vi.fn(() => ({})) })),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  };

  return { default: L };
});

function plot(overrides: Partial<LandPlot> = {}): LandPlot {
  return {
    id: "p-1",
    reference: "PLOT-000412",
    supplier_id: "s-1",
    country: "GH",
    region: "Ashanti",
    area_hectares: 2.4,
    geometry: { type: "Point", coordinates: [0, 0] },
    geometry_source: "GPS_DEVICE",
    accuracy_meters: null,
    collection_date: null,
    validation_status: "PASSED",
    validated_at: null,
    external_id: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// The map only initializes leaflet inside an async effect; the layer-drawing
// effect (which builds the popup) short-circuits until `mapRef`/`leafletRef`
// are populated. Mirroring how the real page mounts the map with an empty
// `plots` array before data loads, we render empty first, wait for map init,
// then rerender with the plot that should produce a popup.
async function getLeafletMock() {
  const leaflet = await import("leaflet");
  return (leaflet as unknown as { default: Record<string, unknown> }).default;
}

async function renderAndGetPopupHtml(plots: LandPlot[]) {
  const L = await getLeafletMock();
  const mapFn = L.map as unknown as ReturnType<typeof vi.fn>;
  const geoJSONFn = L.geoJSON as unknown as ReturnType<typeof vi.fn>;

  const { rerender } = render(<LandPlotMap plots={[]} />);
  await waitFor(() => expect(mapFn).toHaveBeenCalled());

  rerender(<LandPlotMap plots={plots} />);
  await waitFor(() => expect(geoJSONFn).toHaveBeenCalled());

  const layerInstance = geoJSONFn.mock.results.at(-1)?.value as {
    bindPopup: ReturnType<typeof vi.fn>;
  };
  await waitFor(() => expect(layerInstance.bindPopup).toHaveBeenCalled());

  return layerInstance.bindPopup.mock.calls.at(-1)?.[0] as string;
}

describe("<LandPlotMap /> popup", () => {
  it("uses the plot's identity (reference) as the popup heading, not a raw country/region label", async () => {
    const html = await renderAndGetPopupHtml([plot()]);

    expect(html).toContain("PLOT-000412");
  });

  it("escapes a malicious external_id instead of letting it become markup", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const html = await renderAndGetPopupHtml([plot({ external_id: payload })]);

    // The raw payload must never appear verbatim in the popup HTML...
    expect(html).not.toContain(payload);
    // ...it must appear escaped instead...
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");

    // ...and parsing the popup HTML must not produce an executable <img> element.
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, \", and '", () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("PLOT-000412")).toBe("PLOT-000412");
    expect(escapeHtml("GH, Ashanti")).toBe("GH, Ashanti");
  });
});

/**
 * Regression: the plot DETAIL page (`/plots/[id]`) renders
 * `<LandPlotMap plots={[plot]} />` — the data is already present on the very
 * first mount, unlike the list page which mounts empty and fills in later.
 *
 * The map is created inside an async effect (`await import("leaflet")`), while
 * the layer-drawing effect depends on `[plots]` alone and returns early while
 * the refs are still null. With data present at mount, that early return is the
 * only run it ever gets, so the polygon is never drawn and the map sits at its
 * initial world view. The helper above deliberately sidesteps this by rendering
 * empty first; these tests do not.
 */
describe("<LandPlotMap /> with plots present at first mount (detail page)", () => {
  it("draws the plot layer", async () => {
    const L = await getLeafletMock();
    const geoJSONFn = L.geoJSON as unknown as ReturnType<typeof vi.fn>;
    geoJSONFn.mockClear();

    render(<LandPlotMap plots={[plot()]} />);

    await waitFor(() => expect(geoJSONFn).toHaveBeenCalledTimes(1));
  });

  it("fits the map to the plot rather than leaving the initial world view", async () => {
    const L = await getLeafletMock();
    const mapFn = L.map as unknown as ReturnType<typeof vi.fn>;

    // The mock returns one shared map instance for every `L.map()` call, so
    // `fitBounds` accumulates calls across tests. Without clearing it here the
    // assertion passes on a previous test's call and proves nothing.
    const mapInstance = (mapFn as unknown as () => { fitBounds: ReturnType<typeof vi.fn> })();
    mapInstance.fitBounds.mockClear();
    mapFn.mockClear();

    render(<LandPlotMap plots={[plot()]} selectedPlotId="p-1" />);

    await waitFor(() => expect(mapInstance.fitBounds).toHaveBeenCalled());
  });
});

describe("initial viewport", () => {
  it("re-measures the container before fitting, and caps the zoom", async () => {
    /**
     * The bug this covers shipped to production: fitBounds ran while Leaflet
     * still had a 0x0 cached size, which does not throw — it silently leaves
     * the map on its setView() world default. The Land Plots page showed the
     * whole planet with 18 West African plots invisible on it.
     *
     * Ordering is the whole fix, so ordering is what this asserts.
     */
    const L = (await import("leaflet")).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (L.map as any).mock.results.at(-1)?.value ?? (L.map as any)();
    map.invalidateSize.mockClear();
    map.fitBounds.mockClear();

    const order: string[] = [];
    map.invalidateSize.mockImplementation(() => order.push("invalidateSize"));
    map.fitBounds.mockImplementation(() => order.push("fitBounds"));

    render(<LandPlotMap plots={[plot()]} />);

    await waitFor(() => expect(map.fitBounds).toHaveBeenCalled());

    // The init effect also calls invalidateSize in its own frame, so assert
    // the relationship that matters: the fit is immediately preceded by a
    // re-measure, rather than running against a stale 0x0 size.
    expect(order.filter((c) => c === "fitBounds")).toHaveLength(1);
    expect(order[order.indexOf("fitBounds") - 1]).toBe("invalidateSize");
    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxZoom: 12 }),
    );
  });
});
