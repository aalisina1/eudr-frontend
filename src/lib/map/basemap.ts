/**
 * Basemap tile source, in one place because two maps use it.
 *
 * CARTO began requiring an API key for its basemaps and now serves tiles with
 * "API KEY REQUIRED" watermarked diagonally across the image. The request still
 * returns HTTP 200 with a valid PNG, so nothing in the network tab or a status
 * check looks wrong — the failure is only visible in the rendered pixels. It
 * shipped to production and was spotted on a plot map, on a compliance product,
 * where a map that looks broken costs more than it would anywhere else.
 *
 * So: use CARTO when a key is configured, and fall back to a clean keyless
 * source when it is not. A missing key must never again produce a watermarked
 * map — the worst outcome here is a slightly different basemap, not a defaced
 * one.
 *
 * NEXT_PUBLIC_CARTO_KEY is inlined at build time like every NEXT_PUBLIC_*
 * value, so changing it requires a rebuild rather than a restart. The key is
 * public by nature (it ships in the bundle); CARTO scopes it by domain, which
 * is the control that matters.
 */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY?.trim();

export const basemap = CARTO_KEY
  ? {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  : {
      // Keyless fallback. Esri's light gray canvas is close in weight to
      // Voyager, so plot polygons keep their contrast against it.
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri",
      subdomains: "",
      maxZoom: 16,
    };
