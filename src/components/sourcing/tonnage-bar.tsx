"use client";

import { cn } from "@/lib/utils";

/** The hatched "uncovered remainder" background, shared by the bar track and
 * the legend swatch — kept as a raw CSS value (not a Tailwind arbitrary
 * class) since a bracketed `bg-[repeating-linear-gradient(...)]` utility
 * with nested `color-mix()` is fragile to author correctly. Exported (#49)
 * as the canonical value — `CoverageFunnelCard` (PO Detail funnel) used to
 * reproduce this locally with slightly drifted stripe/period values. */
export const HATCH_BACKGROUND =
  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent) 0 1.5px, transparent 1.5px 5.5px)";

interface TonnageBarProps {
  ordered: number;
  allocated: number;
  geolocated: number;
  filed: number;
  /** Unit suffix for the hover/aria label, e.g. " kg" or " t". */
  unit?: string;
  className?: string;
}

/**
 * Slim segmented coverage bar: filed (primary) is a subset of geolocated
 * (accent/copper), which is a subset of allocated (muted grey), which is a
 * subset of ordered — the remainder renders as a hatched, muted "uncovered"
 * background. "Coverage is measured in tonnes, not booleans" (master
 * reframe prompt) — never render a bare Linked/Unlinked badge for this.
 *
 * Reused by PO Detail (#29), Dashboard worklist (#30), and Supplier Detail
 * (#31) wherever a PO or supplier's coverage is summarised.
 */
export function TonnageBar({ ordered, allocated, geolocated, filed, unit = "", className }: TonnageBarProps) {
  // Guard divide-by-zero for a brand-new PO with nothing ordered yet — never
  // expected in practice (quantity is required > 0) but keeps the bar inert
  // (an all-hatched track) rather than NaN-ing widths.
  const safeOrdered = ordered > 0 ? ordered : 1;
  const pct = (v: number) => `${Math.max(0, (v / safeOrdered) * 100)}%`;

  const segments = [
    { value: filed, className: "bg-primary" },
    { value: Math.max(0, geolocated - filed), className: "bg-accent" },
    { value: Math.max(0, allocated - geolocated), className: "bg-foreground/30" },
  ].filter((s) => s.value > 0);

  const label =
    `${ordered}${unit} ordered · ${allocated}${unit} allocated · ` +
    `${geolocated}${unit} geolocated · ${filed}${unit} filed · ` +
    `${Math.max(0, ordered - filed)}${unit} uncovered`;

  return (
    <span
      title={label}
      aria-label={label}
      className={cn("flex h-1.5 w-full max-w-[190px] gap-[1.5px] overflow-hidden rounded-full", className)}
      style={{ background: HATCH_BACKGROUND }}
    >
      {segments.map((s, i) => (
        <span key={i} className={cn("shrink-0 rounded-full", s.className)} style={{ width: pct(s.value) }} />
      ))}
    </span>
  );
}

const LEGEND_ITEMS: { className: string; label: string; style?: React.CSSProperties }[] = [
  { className: "bg-primary", label: "Filed" },
  { className: "bg-accent", label: "Geolocated" },
  { className: "bg-foreground/30", label: "Allocated" },
  { className: "", label: "Uncovered", style: { background: HATCH_BACKGROUND } },
];

/** Coverage-bar legend (Filed / Geolocated / Allocated / Uncovered swatches)
 * — canonized in sourcing-readiness.design-prompt.md Round 3, ships with
 * eudr-frontend #28. Render once above any table of `TonnageBar`s. */
export function CoverageLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-3.5", className)}>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 shrink-0 rounded-[3px]", item.className)} style={item.style} />
          <span className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">
            {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}
