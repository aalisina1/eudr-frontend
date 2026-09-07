import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { TableHead } from "@/components/ui/table";
import { SidebarGroupLabel, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

/**
 * eudr-frontend#155, the structural half of the Render direction
 * (10-Specs/visual-direction-render.md, Decision 1). Each of these is a
 * one-line token or primitive change that a future "tidy-up" could revert
 * without noticing what it cost, so each is pinned with the reason.
 *
 * Deliberately NOT asserted here: the palette and the display face. Step 1
 * keeps both on purpose, so the founder judges Decisions 2 and 3 against a
 * rendered Grovetrace. A test that pinned them would pre-empt that.
 */

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const css = read("../app/globals.css");
const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

describe("square", () => {
  it("--radius is 0, so every derived step is 0 and Badge's rounded-4xl is square", () => {
    // Render measured: border-radius 0px on nav, pills, chips, buttons, inputs, cards.
    expect(root).toMatch(/--radius:\s*0(px|rem)?;/);
  });
});

describe("flat", () => {
  it("--shadow-card is none in both themes; hairlines do the work", () => {
    expect(root).toMatch(/--shadow-card:\s*none;/);
    expect(dark).toMatch(/--shadow-card:\s*none;/);
  });

  it("the grain overlay is gone from <body> and from the stylesheet", () => {
    const layout = read("../app/layout.tsx");
    expect(layout).not.toMatch(/\bgrain\b/);
    expect(css).not.toMatch(/\.grain::after/);
  });
});

describe("mono micro-labels", () => {
  it("defines one .eyebrow utility: mono, uppercase, tracked, muted", () => {
    // Render measured: Neue Montreal Mono, uppercase, +0.65px tracking, #8f8f8f,
    // on eyebrows, sidebar section labels and table headers alike.
    const rule = css.match(/\.eyebrow\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(rule).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(rule).toMatch(/text-transform:\s*uppercase/);
    expect(rule).toMatch(/letter-spacing/);
  });

  it("TableHead carries it by default", () => {
    const { container } = render(
      <table><thead><tr><TableHead>Status</TableHead></tr></thead></table>
    );
    expect(container.querySelector("th")?.className).toContain("eyebrow");
  });

  it("SidebarGroupLabel carries it by default", () => {
    const { container } = render(
      <SidebarProvider><SidebarGroupLabel>Compliance</SidebarGroupLabel></SidebarProvider>
    );
    expect(container.querySelector('[data-slot="sidebar-group-label"]')?.className).toContain("eyebrow");
  });

  it("no page keeps its own copy of the table-header class string", () => {
    // Four detail pages had an identical `const TH = "text-xs font-medium
    // tracking-[0.12em] uppercase ..."`. The drift pattern, again.
    const pages = [
      "../app/(dashboard)/suppliers/[id]/page.tsx",
      "../app/(dashboard)/submissions/[id]/page.tsx",
      "../app/(dashboard)/documents/[id]/page.tsx",
      "../app/(dashboard)/plots/[id]/page.tsx",
    ];
    for (const p of pages) expect(read(p), p).not.toMatch(/const TH = "text-xs font-medium tracking-/);
  });
});

describe("outlined buttons", () => {
  it("the default Button variant is outlined and transparent, as every Render action is", () => {
    const { container } = render(<Button>Add supplier</Button>);
    const cls = container.querySelector("button")?.className ?? "";
    expect(cls).toMatch(/\bborder\b/);
    expect(cls).not.toMatch(/\bbg-primary\b/);
  });

  it("destructive keeps its fill: a delete must still read as one", () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.querySelector("button")?.className).toMatch(/bg-destructive/);
  });
});

/**
 * eudr-frontend#156, the two founder decisions after step 1: neutral ground,
 * upright display. Both are token swaps. Both are pinned here so a tidy-up
 * cannot drift them back, and so the reversal, if the founder changes their
 * mind, is a deliberate edit to this file, not an accident.
 */
describe("neutral ground (#156, Decision 2)", () => {
  it("light is white with near-black text and gray hairlines, as Render measures", () => {
    expect(root).toMatch(/--background:\s*#FFFFFF;/i);
    expect(root).toMatch(/--foreground:\s*#141414;/i);
    expect(root).toMatch(/--muted-foreground:\s*#8F8F8F;/i);
    expect(root).toMatch(/--border:\s*#E3E3E3;/i);
    expect(root).not.toMatch(/#F6F3ED|#0B1D1C/i); // the parchment and the forest are gone from the ground
  });

  it("dark mirrors it: near-black ground, light text, dark hairlines", () => {
    expect(dark).toMatch(/--background:\s*#0A0A0A;/i);
    expect(dark).toMatch(/--foreground:\s*#F0F0F0;/i);
    expect(dark).not.toMatch(/#0A1514|#0F2220/i);
  });

  it("the sidebar is the page ground, not a dark panel", () => {
    expect(root).toMatch(/--sidebar:\s*#FFFFFF;/i);
    expect(dark).toMatch(/--sidebar:\s*#0A0A0A;/i);
  });

  it("brand green survives as --primary; it is the one colour, used sparingly", () => {
    expect(root).toMatch(/--primary:\s*#1A6B5A;/i);
  });
});

describe("upright display (#156, Decision 3)", () => {
  it("Fraunces is no longer loaded; Geist Sans and Geist Mono are", () => {
    const layout = read("../app/layout.tsx");
    expect(layout).not.toMatch(/Fraunces\(|next\/font\/google/);
    expect(layout).toMatch(/geist\/font\/sans/);
    expect(layout).toMatch(/geist\/font\/mono/);
  });

  it(".text-display is the sans, medium weight, tight tracking, upright", () => {
    // Render measured: Roobert 32px / 500 / -0.32px, no italic.
    const rule = css.match(/\.text-display\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(rule).toMatch(/font-family:\s*var\(--font-display\)/);
    expect(rule).toMatch(/font-weight:\s*500/);
    expect(rule).toMatch(/letter-spacing:\s*-0\.0\d+em/);
    expect(rule).not.toMatch(/WONK|SOFT|opsz|italic/);
    expect(css).not.toMatch(/--display-wonk|--display-soft/);
  });

  it("no caller still asks the display face to be italic or light", () => {
    // 16 page titles and the primitives carried `text-display ... italic font-light`.
    const hits = execSync(
      `grep -rlE 'text-display[^"]*(italic|font-light)|(italic|font-light)[^"]*text-display' src --include='*.tsx' | grep -v __tests__ || true`,
      { cwd: resolve(__dirname, "../.."), encoding: "utf8" }
    ).trim();
    expect(hits, hits).toBe("");
  });
});
