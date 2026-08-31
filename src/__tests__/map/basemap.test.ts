import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The failure this guards against shipped to production and was found by eye:
 * CARTO serves HTTP 200 with a valid PNG when no key is supplied, but the image
 * has "API KEY REQUIRED" watermarked across it. Nothing in a status check or the
 * network tab looks wrong, so only a rendered map reveals it.
 */
describe("basemap", () => {
  const original = process.env.NEXT_PUBLIC_CARTO_KEY;

  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env.NEXT_PUBLIC_CARTO_KEY = original;
    vi.resetModules();
  });

  it("uses CARTO with the key appended when one is configured", async () => {
    process.env.NEXT_PUBLIC_CARTO_KEY = "test-key-123";
    const { basemap } = await import("@/lib/map/basemap");
    expect(basemap.url).toContain("basemaps.cartocdn.com");
    expect(basemap.url).toContain("key=test-key-123");
  });

  it("never requests CARTO without a key — that returns watermarked tiles", async () => {
    delete process.env.NEXT_PUBLIC_CARTO_KEY;
    const { basemap } = await import("@/lib/map/basemap");
    expect(basemap.url).not.toContain("cartocdn");
    expect(basemap.url).toContain("arcgisonline.com");
  });

  it("treats a whitespace-only key as unset rather than appending it", async () => {
    process.env.NEXT_PUBLIC_CARTO_KEY = "   ";
    const { basemap } = await import("@/lib/map/basemap");
    expect(basemap.url).not.toContain("cartocdn");
  });
});
