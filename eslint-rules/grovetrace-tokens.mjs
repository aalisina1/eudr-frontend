/**
 * The design tokens, as lint rules (eudr-frontend#128).
 *
 * Sibling to grovetrace-voice.mjs and built on the same argument (ADR-0027):
 * a doctrine's countable half ships as a CI gate, because prose guidance has
 * failed twice in this project with measurements behind it. The visual-
 * identity spec's own finding makes the case again — a good token layer
 * already existed in globals.css, and 704 arbitrary-value utilities bypassed
 * it anyway. Nobody chose to bypass it; each was typed mid-feature by someone
 * who needed a colour and reached for the hex in the design file.
 *
 * The bypass was not cosmetic. A hex literal cannot flip with the theme, and
 * the NEGLIGIBLE badge's text-[#1A6B5A] measured 2.12:1 on a dark card (#125).
 * The first rule below exists to stop that specific class of defect coming
 * back; the other two keep the type scale (#126) and the elevation idiom real.
 *
 * Deliberately NOT gated: the radius rule (#127). Choosing rounded-lg over
 * rounded-xl is a design call, not an error. Naming what cannot be encoded is
 * part of the decision.
 *
 * Spec: eudr-vault/10-Specs/visual-identity.md, Decision 5.
 */

/** Visit every string a class name could live in. Comments are never visited.
 *  Test files are exempt: eslint-token-rules.test.ts plants violations on
 *  purpose to prove each rule can fail, and RuleTester lints those snippets
 *  directly rather than through the file. */
function visitStrings(context, check) {
  const filename = context.filename ?? context.getFilename();
  if (/__tests__|\.test\.|\.spec\./.test(filename)) return {};
  return {
    Literal(node) {
      if (typeof node.value === "string") check(node, node.value);
    },
    TemplateElement(node) {
      const raw = node.value?.cooked;
      if (typeof raw === "string") check(node, raw);
    },
    JSXText(node) {
      check(node, node.value);
    },
  };
}

/**
 * Tailwind's arbitrary-colour syntax: `<utility>-[#hex]`, with an optional
 * `/opacity`. Matching the `-[#` shape rather than any `#hex` is what keeps a
 * raw "#34D399" fed to Leaflet (which draws to canvas and cannot read CSS
 * variables) out of scope — that colour is legitimately fixed and renders on
 * map tiles, not the card.
 */
const HEX_UTILITY = /\b[a-z][a-z-]*-\[#[0-9a-fA-F]{3,8}\](?:\/\d+)?/;

const noHexInUtility = {
  meta: {
    type: "problem",
    docs: { description: "No hex colour literals in Tailwind utilities; use the tokens." },
    schema: [],
    messages: {
      hexUtility:
        "Hex colour in a Tailwind utility. A literal cannot flip with the theme: " +
        "text-[#1A6B5A] is --primary in light mode only and measured 2.12:1 on a dark " +
        "card (#125). Use the token — success/warning/pending/info/destructive for " +
        "status, primary/accent/muted for brand — each has a -foreground tuned for " +
        "text on its 10% tint, and status-token-contrast.test.ts holds them to AA in " +
        "both themes.",
    },
  },
  create(context) {
    return visitStrings(context, (node, value) => {
      if (HEX_UTILITY.test(value)) context.report({ node, messageId: "hexUtility" });
    });
  },
};

/** `text-[13px]`, `text-[12.5px]`, `text-[0.8125rem]`. Not `text-[var(--x)]`. */
const ARBITRARY_FONT_SIZE = /\btext-\[[0-9.]+(px|rem|em|pt)\]/;

const noArbitraryFontSize = {
  meta: {
    type: "problem",
    docs: { description: "No arbitrary font sizes; use the scale defined in @theme." },
    schema: [],
    messages: {
      arbitrarySize:
        "Arbitrary font size. The scale is defined once in globals.css @theme — " +
        "xs 11 / sm 13 / base 15, then lg and up — and it is only real if it cannot be " +
        "bypassed. Thirteen sizes shipped before #126, six of them half-pixel, because " +
        "each screen picked its own. Use the nearest named step.",
    },
  },
  create(context) {
    return visitStrings(context, (node, value) => {
      if (ARBITRARY_FONT_SIZE.test(value)) context.report({ node, messageId: "arbitrarySize" });
    });
  },
};

/**
 * `shadow-[…]` whose value is a literal. A value that references a token
 * (`var(--…)`) is not bypassing anything — shadcn's sidebar uses
 * `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` as a hairline ring in the
 * sidebar's own colours, and that is correct.
 */
const ARBITRARY_SHADOW = /\bshadow-\[([^\]]*)\]/g;

const noArbitraryShadow = {
  meta: {
    type: "problem",
    docs: { description: "No literal arbitrary shadows; use shadow-card or a token." },
    schema: [],
    messages: {
      arbitraryShadow:
        "Literal shadow value. The card-elevation idiom is `shadow-card` " +
        "(--shadow-card, which already has a dark-mode variant); fourteen hand-written " +
        "shadows were duplicating it with slightly different numbers. If you need a " +
        "hairline, reference a token inside the brackets: shadow-[0_0_0_1px_var(--border)].",
    },
  },
  create(context) {
    return visitStrings(context, (node, value) => {
      for (const m of value.matchAll(ARBITRARY_SHADOW)) {
        if (!m[1].includes("var(--")) {
          context.report({ node, messageId: "arbitraryShadow" });
          return;
        }
      }
    });
  },
};

const plugin = {
  rules: {
    "no-hex-in-utility": noHexInUtility,
    "no-arbitrary-font-size": noArbitraryFontSize,
    "no-arbitrary-shadow": noArbitraryShadow,
  },
};

export default plugin;
