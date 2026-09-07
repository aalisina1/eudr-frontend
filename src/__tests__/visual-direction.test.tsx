import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
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
