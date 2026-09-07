import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The app's tokens are the company's brand tokens (eudr-frontend#166).
 *
 * The values below are copied from grovetrace-company/04-ops/brand/README.md
 * ("Tokens (match grovetrace.com)", chosen 2026-07-21). That repo is private
 * and not present in CI, so the values are pinned here rather than read from
 * it. If the brand changes, change the README first, then this file, then
 * globals.css: the point of the test is that the app cannot drift from the
 * brand on its own, which is exactly what it had done for two visual waves
 * (the green was 19 degrees toward teal, the ink was teal-black, the page was
 * parchment) before anyone opened that README.
 *
 * The structural half pins the founder's D4/D5 answers from the rendered
 * candidate sheet (vault 10-Specs/ui-direction-grovetrace.md): a 6px radius
 * scale, hairline cards with no shadow, no grain, square status chips.
 */

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
const badge = readFileSync(resolve(__dirname, "../components/ui/badge.tsx"), "utf8");
const layout = readFileSync(resolve(__dirname, "../app/layout.tsx"), "utf8");
const eslintConfig = readFileSync(resolve(__dirname, "../../eslint.config.mjs"), "utf8");

function block(selector: string): string {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no ${selector} block in globals.css`);
  return m[1];
}
function token(blockCss: string, name: string): string {
  const m = blockCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`--${name} not found`);
  return m[1].trim();
}

const light = block(":root");
const dark = block(".dark");

// grovetrace-company/04-ops/brand/README.md, verbatim (case-normalised).
const BRAND = {
  green: "#1F6B43",
  deepGreen: "#174F32",
  darkModeGreen: "#4CAF7D",
  ink: "#1C2420",
  page: "#FBFAF7",
};

describe("the app's colour tokens are the brand's (D1)", () => {
  it("light: green, ink and page are the README's values", () => {
    expect(token(light, "primary").toUpperCase()).toBe(BRAND.green);
    expect(token(light, "foreground").toUpperCase()).toBe(BRAND.ink);
    expect(token(light, "background").toUpperCase()).toBe(BRAND.page);
  });

  it("dark: the primary is the README's dark-mode green", () => {
    expect(token(dark, "primary").toUpperCase()).toBe(BRAND.darkModeGreen);
  });

  it("the sign-in hero runs through the brand's three darks", () => {
    const hero = token(light, "hero-gradient").toUpperCase();
    for (const c of [BRAND.ink, BRAND.deepGreen, BRAND.green]) expect(hero).toContain(c);
  });

  it("success is its own green, never the primary, in either theme", () => {
    // Before #166 the dark theme used #34D399 for both, so a filed statement
    // and a primary action were the same colour.
    expect(token(light, "success")).not.toBe(token(light, "primary"));
    expect(token(dark, "success")).not.toBe(token(dark, "primary"));
  });

  it("the dark sidebar panel is the ink, not a teal (D2: panel stays)", () => {
    expect(token(light, "sidebar").toUpperCase()).toBe(BRAND.ink);
  });

  it("no token is a Tailwind default-palette colour", () => {
    // The old --info was indigo-500 (#6366F1) and the old dark --primary was
    // emerald-400 (#34D399): hues the brand file does not have.
    for (const b of [light, dark]) {
      expect(b.toUpperCase()).not.toContain("#6366F1");
      expect(b.toUpperCase()).not.toContain("#34D399");
    }
  });
});

describe("the structure is the founder's D4 b and D5 (candidate sheet, 2026-09-07)", () => {
  it("the radius scale derives from 6px", () => {
    expect(token(light, "radius")).toBe("0.375rem");
    // The scale still derives, so one token moves everything.
    expect(css).toMatch(/--radius-xl:\s*calc\(var\(--radius\)\s*\*\s*1\.4\)/);
  });

  it("cards are a hairline, not an elevation, in both themes", () => {
    expect(token(light, "shadow-card")).toBe("none");
    expect(token(dark, "shadow-card")).toBe("none");
  });

  it("the paper grain is gone", () => {
    expect(css).not.toContain(".grain");
    expect(layout).not.toMatch(/className=\{`[^`]*\bgrain\b/);
  });

  it("status chips are square: Badge's own default is rounded-md, not a pill", () => {
    expect(badge).toMatch(/rounded-md border border-transparent/);
    expect(badge).not.toContain("rounded-4xl");
    expect(badge).not.toContain("rounded-full");
  });
});

describe("the palette gate is on", () => {
  it("no-palette-utility is an error in eslint.config.mjs", () => {
    expect(eslintConfig).toMatch(/"grovetrace-tokens\/no-palette-utility":\s*"error"/);
  });
});
