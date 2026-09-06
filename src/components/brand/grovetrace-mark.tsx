import { PRODUCT_NAME } from "@/lib/brand";
/**
 * The Grovetrace mark.
 *
 * Ported from `grovetrace-company/04-ops/brand/grovetrace-mark{,-small}.svg`,
 * which existed from the start but was never wired up — every surface rendered
 * lucide's generic `TreePine` glyph instead.
 *
 * The concept is the reason it is worth using: the canopy is an EUDR land-plot
 * polygon with survey-vertex beads, on a trunk. It says what the product does.
 * A stock tree icon says "sustainability".
 *
 * Both variants paint with `currentColor` rather than the brand hex, so a
 * caller sets the colour through `className` and the mark themes with its
 * surface (light sidebar, dark sidebar, brand-green ground) without needing a
 * second asset.
 */

interface GrovetraceMarkProps {
  /**
   * `full` is the five-vertex mark. `small` is the brand's own simplified
   * variant for ≤32px — three beads and a heavier stroke, because five beads
   * at sidebar size collapse into mush.
   */
  variant?: "full" | "small";
  className?: string;
}

export function GrovetraceMark({ variant = "full", className }: GrovetraceMarkProps) {
  const small = variant === "small";

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={PRODUCT_NAME}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {small ? (
        <>
          <polygon
            points="50,11 82,31 71,65 29,63 18,29"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="11" r="9.5" fill="currentColor" />
          <circle cx="82" cy="31" r="9.5" fill="currentColor" />
          <circle cx="18" cy="29" r="9.5" fill="currentColor" />
          <rect x="44.5" y="64" width="11" height="27" rx="5" fill="currentColor" />
        </>
      ) : (
        <>
          <polygon
            points="50,9 82,29 71,63 29,61 18,27"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="9" r="7.5" fill="currentColor" />
          <circle cx="82" cy="29" r="7.5" fill="currentColor" />
          <circle cx="71" cy="63" r="7.5" fill="currentColor" />
          <circle cx="29" cy="61" r="7.5" fill="currentColor" />
          <circle cx="18" cy="27" r="7.5" fill="currentColor" />
          <rect x="45.75" y="63" width="8.5" height="28" rx="4" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
