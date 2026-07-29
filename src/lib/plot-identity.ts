/** Plot display identity (ADR-0026). Pure — no fetch/framework deps,
 * mirroring consignment-format.ts's role for shipments.
 *
 * `reference` is the identity; `external_id` is the SOURCE SYSTEM's code and
 * is shown as context, never as the identity. The fallbacks exist only for
 * responses cached from before the backend migration — after it, every plot
 * has a reference. */
import type { LandPlot } from "@/lib/api/types";

type PlotLike = Pick<
  LandPlot,
  "id" | "reference" | "country" | "region" | "area_hectares" | "external_id"
>;

function place(plot: PlotLike): string {
  return [plot.country, plot.region].filter(Boolean).join(", ");
}

function contextParts(plot: PlotLike): string[] {
  const area = plot.area_hectares != null ? `${plot.area_hectares} ha` : "";
  return [place(plot), area].filter(Boolean);
}

export function plotIdentity(plot: PlotLike): { primary: string; secondary: string } {
  const parts = contextParts(plot);
  const secondary = [...parts, plot.external_id].filter(Boolean).join(" · ");

  // A naked UUID is never an identity — fall back to place (country/region),
  // then to a short id, so the user always has something to read and say out
  // loud. Note: this deliberately falls back to `place`, not `parts[0]` —
  // parts[0] can be the area ("2.4 ha") when place is blank, which is not a
  // usable identity either.
  const primary = plot.reference || place(plot) || `Plot ${plot.id.slice(0, 8)}`;

  return { primary, secondary };
}

export function plotMatchesQuery(plot: PlotLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [plot.reference, plot.external_id, plot.region, plot.country].some((f) =>
    f?.toLowerCase().includes(q),
  );
}
