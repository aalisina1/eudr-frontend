import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * One type scale, defined once (eudr-frontend#126).
 *
 * Before this, thirteen distinct arbitrary pixel sizes shipped — six of them
 * half-pixel (10.5, 11.5, 12.5, 13.5, 14.5) — running alongside Tailwind's
 * named scale and near-duplicating it: `text-[13px]` ×105 sat one pixel from
 * `text-sm`, `text-[11px]` ×48 one pixel from `text-xs`. Nothing produces
 * 12.5px from a scale; those were nudged per component by eye.
 *
 * The fix redefines the named scale's VALUES in `@theme` to what this dense
 * compliance UI actually wants. It adds no names at all: a `2xs` step for the
 * 10px eyebrows was tried first and this file's own 1px-gap check rejected it
 * (10 and 11 are a pixel apart). The eyebrows move to 11px, which is also the
 * smallest size a compliance officer should be asked to read.
 *
 * Two guards, both load-bearing:
 * 1. The scale is what we said it is. A "helpful" bump of `--text-sm` back to
 *    14px silently re-widens every table in the app.
 * 2. No arbitrary `text-[Npx]` anywhere in src/. The scale is only real if
 *    it cannot be bypassed. #128 adds the author-time lint for this; this is
 *    the regression guard that runs in `npm test` regardless.
 */

const SRC = resolve(__dirname, "..");
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");

/** The scale. Ratios between steps are ~1.1–1.2, and no two steps sit 1px apart. */
const SCALE: Record<string, { px: number; lh: number }> = {
  xs: { px: 11, lh: 16 },
  sm: { px: 13, lh: 20 },
  base: { px: 15, lh: 22 },
};

describe("the type scale is defined once, in @theme", () => {
  const theme = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  for (const [step, { px, lh }] of Object.entries(SCALE)) {
    it(`text-${step} is ${px}px / ${lh}px`, () => {
      const size = theme.match(new RegExp(`--text-${step}:\\s*([\\d.]+)(px|rem)`));
      const line = theme.match(new RegExp(`--text-${step}--line-height:\\s*([\\d.]+)(px|rem)`));
      expect(size, `--text-${step} must be declared in @theme inline`).not.toBeNull();
      expect(line, `--text-${step}--line-height must be declared in @theme inline`).not.toBeNull();
      const toPx = (v: string, u: string) => (u === "rem" ? parseFloat(v) * 16 : parseFloat(v));
      expect(toPx(size![1], size![2])).toBe(px);
      expect(toPx(line![1], line![2])).toBe(lh);
    });
  }

  it("no two adjacent steps are 1px apart, which is the defect this replaces", () => {
    const sizes = Object.values(SCALE).map((s) => s.px).sort((a, b) => a - b);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i] - sizes[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("no arbitrary font sizes remain in src/", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "__tests__") walk(p, out);
      } else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  }

  it("zero text-[Npx] utilities", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(/text-\[[0-9.]+px\]/g);
      if (hits) offenders.push(`${file.replace(SRC + "/", "")}: ${[...new Set(hits)].join(" ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
