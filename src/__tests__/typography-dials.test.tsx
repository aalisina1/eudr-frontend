import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TableCell } from "@/components/ui/table";
import { SheetTitle } from "@/components/ui/sheet";
import { DialogTitle } from "@/components/ui/dialog";
import { AlertDialogTitle } from "@/components/ui/alert-dialog";

/**
 * Guards #130: the typography dials that were sitting unused in the font
 * file, and the two primitive defaults that carry the display face and
 * tabular figures to every call site.
 *
 * Why these are worth a test: each was a one-line change that a future
 * "tidy-up" could revert without noticing what it cost. Loading only `opsz`
 * again silently turns the display face back into a generic serif; dropping
 * `tabular-nums` from TableCell makes every quantity column ragged.
 */

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

// #130 pinned Fraunces' WONK/SOFT axes here. #156 retired Fraunces for an
// upright sans (visual-direction-render.md, Decision 3), a founder decision,
// made against the step-1 screenshots, not a tidy-up. Those pins now live in
// visual-direction.test.tsx as their inverse.

describe("primitives carry the type decisions so call sites do not have to", () => {
  it("every TableCell has tabular figures by default", () => {
    const { container } = render(
      <table><tbody><tr><TableCell>1,234</TableCell></tr></tbody></table>
    );
    expect(container.querySelector("td")?.className).toContain("tabular-nums");
  });

  it("sheet, dialog and alert-dialog titles take the display face", () => {
    // These render without their Root providers under Base UI for the class
    // check we need; anything deeper would be testing the library.
    for (const [Title, name] of [
      [SheetTitle, "SheetTitle"],
      [DialogTitle, "DialogTitle"],
      [AlertDialogTitle, "AlertDialogTitle"],
    ] as const) {
      let cls = "";
      try {
        const { container } = render(<Title>Heading</Title>);
        cls = container.firstElementChild?.className ?? "";
      } catch {
        // If the primitive insists on a Root, fall back to the source: the
        // default class string is a literal in the component file.
        const file = name === "SheetTitle" ? "sheet" : name === "DialogTitle" ? "dialog" : "alert-dialog";
        const src = read(`../components/ui/${file}.tsx`);
        cls = src.match(new RegExp(`function ${name}[\\s\\S]*?cn\\(\\s*"([^"]+)"`))?.[1] ?? "";
      }
      expect(cls, `${name} default class`).toContain("text-display");
      // #156 made the display face upright; `italic` is gone by decision.
      expect(cls, `${name} default class`).not.toContain("italic");
    }
  });
});
