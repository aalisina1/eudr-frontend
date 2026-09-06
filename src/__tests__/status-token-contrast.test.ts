import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The semantic status tokens must pass WCAG AA in BOTH themes, measured the
 * way the app actually uses them: text on a 10% tint of the base colour, over
 * the card background. That is the badge idiom on every list and detail page.
 *
 * This exists because it was not true. eudr-frontend#125: the NEGLIGIBLE
 * badge hardcoded `text-[#1A6B5A]`, which is the light-mode primary; in dark
 * mode it cannot flip and measured 2.12:1 on a near-black card. The red was
 * failing too (2.98:1). The fix was to add these tokens and route every
 * status colour through them — and this test is what stops a token edit from
 * quietly undoing that.
 *
 * Reads globals.css directly rather than rendering, so it is fast and has no
 * jsdom colour-resolution caveats. If the token block moves, update the
 * regexes; do not weaken the threshold.
 */

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): string {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no ${selector} block in globals.css`);
  return m[1];
}

function token(blockCss: string, name: string): string {
  const m = blockCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} not defined`);
  return m[1];
}

type RGB = [number, number, number];
const hex = (h: string): RGB =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function blend(fg: RGB, bg: RGB, alpha: number): RGB {
  return fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i])) as RGB;
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The four new pairs, plus `destructive`, whose text-on-tint colour is the
 *  base itself — that is how shadcn's own `Badge destructive` variant paints
 *  (`bg-destructive/10 text-destructive`), so it needs no `-foreground`. */
const STATUSES: ReadonlyArray<{ base: string; fg: string }> = [
  { base: "success", fg: "success-foreground" },
  { base: "warning", fg: "warning-foreground" },
  { base: "pending", fg: "pending-foreground" },
  { base: "info", fg: "info-foreground" },
  { base: "destructive", fg: "destructive" },
];
const THEMES = [
  { name: "light", block: block(":root") },
  { name: "dark", block: block(".dark") },
];

/** WCAG AA for normal text. Badge copy is 11-13px, which is "normal", not "large". */
const AA = 4.5;

describe("status tokens pass WCAG AA on their own tint, in both themes", () => {
  for (const theme of THEMES) {
    const card = hex(token(theme.block, "card"));
    for (const status of STATUSES) {
      it(`${theme.name}: --${status.fg} on --${status.base}/10 over --card`, () => {
        const base = hex(token(theme.block, status.base));
        const fg = hex(token(theme.block, status.fg));
        const tint = blend(base, card, 0.1);
        const ratio = contrast(fg, tint);
        expect(ratio, `${status.base} in ${theme.name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

describe("the defect this guards against", () => {
  it("the old hardcoded light-mode green fails on the dark card, as it did in #125", () => {
    // Regression pin: this is the number that was shipping. If someone
    // "simplifies" the dark palette back to a single green, this documents
    // why that is not a simplification.
    const dark = THEMES[1].block;
    const tint = blend(hex(token(dark, "success")), hex(token(dark, "card")), 0.1);
    expect(contrast(hex("#1A6B5A"), tint)).toBeLessThan(3);
  });
});
