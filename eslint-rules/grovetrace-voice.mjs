/**
 * The countable half of the product voice, as lint rules.
 *
 * Why this is code and not a style guide: prose guidance has failed twice in
 * this project with measurements behind it. `grovetrace-sales/playbook/voice.md`
 * exists *because* it failed for outreach ("prose guidance loses to a hurried
 * session, and it already has"). The umbrella CLAUDE.md records the same for
 * Serena — a prose rule and a SessionStart hook, 69 sessions live, zero calls.
 * Playbooks §3: "If a behaviour needs to happen every time, put it in CI or a
 * hook that blocks, not in a document that asks nicely."
 *
 * Most copy here is not written by someone sitting down to write copy. It is
 * written incidentally, mid-feature, by whoever is building the screen. The
 * check has to meet them where the string is typed.
 *
 * Decision: ADR-0027. Spec: 10-Specs/product-voice-and-identity.md.
 *
 * Deliberately NOT implemented: the sentence-length bands from voice.md
 * (15-25 words, >=9 average). UI labels are fragments by necessity — "Suppliers"
 * is a correct page title — and porting the bands would force filler into
 * exactly the labels that are already right.
 */

/** A string is "prose" if it contains a space. Guards every rule below from
 *  firing on identifiers, URLs, API paths, query keys and CSS class strings,
 *  which are code that happens to be quoted rather than anything a user reads.
 *  `"/api/v1/accounts/organization/"` is a path; "your organization is..." is
 *  copy. The space is what separates them, cheaply and without false positives. */
function isProse(value) {
  return typeof value === "string" && /\s/.test(value.trim());
}

/** Walk every user-visible string in a file: string literals, template chunks,
 *  and JSX text. Comments are not visited at all, which is intentional — they
 *  are not user-visible and sweeping them buries the lines that are. */
function visitUserFacingStrings(context, check) {
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

const noEmDash = {
  meta: {
    type: "problem",
    docs: { description: "No em dashes in user-visible copy." },
    schema: [],
    messages: {
      emDash:
        "Em dash in user-visible copy. Grovetrace writes without them (voice.md: " +
        "0 em dashes). Split the sentence, or use a comma. " +
        "The standalone — used as an empty table cell is allowed and is not this.",
    },
  },
  create(context) {
    // Test files are exempt, for the same reason the 393 code-comment em dashes
    // are a separate low-priority chore (#120): a `describe("TracesPanel — ...")`
    // title is never rendered, and sweeping ~60 of them would bury the lines a
    // customer actually reads. Copy assertions inside tests are still protected,
    // just not by this rule: change the source copy and the assertion fails,
    // which is a sharper signal than a lint error on the same line.
    const filename = context.filename ?? context.getFilename();
    if (/__tests__|\.test\.|\.spec\./.test(filename)) return {};
    return visitUserFacingStrings(context, (node, value) => {
      if (!value.includes("—")) return;
      // The empty-cell convention: a cell whose entire content is an em dash,
      // meaning "no value". That is table typography, not prose, and replacing
      // it with "Not set" adds noise to dense compliance tables. Kept by
      // decision (spec, Decision 3) — so this exclusion is required behaviour.
      if (value.trim() === "—") return;
      context.report({ node, messageId: "emDash" });
    });
  },
};

const noUsSpelling = {
  meta: {
    type: "problem",
    docs: { description: "User-visible copy is en-GB." },
    schema: [],
    messages: {
      usSpelling:
        "en-US spelling '{{word}}' in user-visible copy. The product speaks en-GB: " +
        "it matches the EU regulatory register the buyers read all day, and most of " +
        "the copy already written. Use '{{suggestion}}'.",
    },
  },
  create(context) {
    // Test files are exempt. Their strings are `it("attaches authorization
    // header...")` descriptions and TypeScript type names like `Organization`,
    // neither of which a user ever reads. A test that asserts on stale copy
    // fails on its own assertion, which is a better signal than a lint error
    // on its description. The em-dash rule deliberately does NOT make this
    // exemption: an em dash in a test means the test asserts copy that has one,
    // so it must be updated in step with the source.
    const filename = context.filename ?? context.getFilename();
    if (/__tests__|\.test\.|\.spec\./.test(filename)) return {};
    // -ize/-isation family only. Deliberately narrow: this is not a general
    // en-US dictionary, and words like "size" or "prize" must never match.
    const PATTERN =
      /\b(organiz|prioritiz|recogniz|analyz|apologiz|authoriz|categoriz|customiz|emphasiz|finaliz|initializ|minimiz|maximiz|normaliz|optimiz|organis?ation|realiz|standardiz|summariz|synchroniz|utiliz)(\w*)/gi;
    return visitUserFacingStrings(context, (node, value) => {
      if (!isProse(value)) return;
      for (const m of value.matchAll(PATTERN)) {
        const word = m[0];
        if (!/z/i.test(word)) continue; // already en-GB
        context.report({
          node,
          messageId: "usSpelling",
          data: { word, suggestion: word.replace(/z/gi, (c) => (c === "Z" ? "S" : "s")) },
        });
      }
    });
  },
};

const requireDateLocale = {
  meta: {
    type: "problem",
    docs: { description: "Date formatting must pin a locale." },
    schema: [],
    messages: {
      bareLocale:
        "`{{method}}()` with no locale renders in the *viewer's* browser locale, so a " +
        "German auditor sees 5.9.2026 in one table and 5 September 2026 in the next, " +
        "on one page. Use the shared helper in @/lib/format-date, or pass \"en-GB\".",
    },
  },
  create(context) {
    const METHODS = new Set([
      "toLocaleDateString",
      "toLocaleTimeString",
      "toLocaleString",
    ]);
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression") return;
        const name = callee.property?.name;
        if (!METHODS.has(name)) return;
        if (node.arguments.length > 0) return;
        context.report({ node, messageId: "bareLocale", data: { method: name } });
      },
    };
  },
};

const productNameFromBrandModule = {
  meta: {
    type: "problem",
    docs: { description: "The product name is defined once." },
    schema: [],
    messages: {
      hardcoded:
        "The product name is written as a literal here. It is defined once in " +
        "@/lib/brand.ts — import PRODUCT_NAME. Four competing descriptors " +
        "(\"EUDR Compliance Platform\", \"EUDR Compliance\", \"EUDR Platform\", " +
        "\"Grovetrace EUDR Compliance Platform\") existed precisely because nothing " +
        "defined it in one place.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    // brand.ts is where it is allowed to be a literal. Tests are exempt because
    // asserting on a literal rendered value is the point of a test.
    if (/src[\\/]lib[\\/]brand\.ts$/.test(filename)) return {};
    if (/__tests__|\.test\.|\.spec\./.test(filename)) return {};
    return visitUserFacingStrings(context, (node, value) => {
      if (/\bGrovetrace\b/.test(value)) {
        context.report({ node, messageId: "hardcoded" });
      }
    });
  },
};

const plugin = {
  rules: {
    "no-em-dash": noEmDash,
    "no-us-spelling": noUsSpelling,
    "require-date-locale": requireDateLocale,
    "product-name-from-brand-module": productNameFromBrandModule,
  },
};

export default plugin;
