import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../../eslint-rules/grovetrace-voice.mjs";

/**
 * Proof that the voice gate can fail.
 *
 * Playbooks §3: **"A guard that can't fail is worse than no guard."** A lint
 * rule that silently matches nothing would leave the project believing the
 * doctrine is enforced while copy drifts back, which is worse than having no
 * rule at all — the false confidence is the damage.
 *
 * ADR-0027 makes this a required deliverable, not a nicety: every check must
 * red against a planted violation, and the empty-cell `"—"` exclusion must be
 * proven *not* to fire. These run in `npm test`, so the proof cannot rot the
 * way a one-off manual check does.
 *
 * `valid` cases are as load-bearing as `invalid` ones here. A rule that flags
 * `"—"` in a table cell, or `organization` inside an API path, would be
 * reverted within a day and the doctrine would go back to being prose.
 */

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-em-dash", plugin.rules["no-em-dash"], {
  valid: [
    // The empty-cell convention (spec Decision 3). This exclusion is
    // required behaviour: 31 table cells rely on it.
    { code: 'const x = "—";' },
    { code: "const y = <td>—</td>;" },
    { code: 'const z = value ?? "—";' },
    // Comments are never visited. They are a separate chore (#120).
    { code: "// a comment — with an em dash\nconst a = 1;" },
    { code: "const b = 'no dash here';" },
  ],
  invalid: [
    {
      code: 'const a = "Submitted — waiting for TRACES";',
      errors: [{ messageId: "emDash" }],
    },
    {
      code: "const b = <p>All data complete — ready to file</p>;",
      errors: [{ messageId: "emDash" }],
    },
    {
      // Template literals too, which is where several real ones lived.
      code: "const c = `${n} lots uncovered — window closing`;",
      errors: [{ messageId: "emDash" }],
    },
  ],
});

ruleTester.run("no-us-spelling", plugin.rules["no-us-spelling"], {
  valid: [
    // Not prose: no space. An API path is code that happens to be quoted,
    // and flagging it would make the rule unusable.
    { code: 'authFetch("/api/v1/accounts/organization/");' },
    { code: 'const k = "organization";' },
    { code: 'const g = "your organisation is registered";' },
    // Must never match merely because the word contains "z".
    { code: 'const s = "the size of the prize";' },
  ],
  invalid: [
    {
      code: 'const a = "identify your organization as an operator";',
      errors: [{ messageId: "usSpelling" }],
    },
    {
      code: "const b = <p>We could not authorize the request</p>;",
      errors: [{ messageId: "usSpelling" }],
    },
  ],
});

ruleTester.run("require-date-locale", plugin.rules["require-date-locale"], {
  valid: [
    { code: 'new Date(x).toLocaleDateString("en-GB");' },
    { code: 'n.toLocaleString("en-GB", { minimumFractionDigits: 2 });' },
    { code: "formatDate(x);" },
  ],
  invalid: [
    {
      code: "new Date(x).toLocaleDateString();",
      errors: [{ messageId: "bareLocale" }],
    },
    { code: "n.toLocaleString();", errors: [{ messageId: "bareLocale" }] },
    {
      code: "d.toLocaleTimeString();",
      errors: [{ messageId: "bareLocale" }],
    },
  ],
});

ruleTester.run(
  "product-name-from-brand-module",
  plugin.rules["product-name-from-brand-module"],
  {
    valid: [
      { code: "const a = PRODUCT_NAME;" },
      { code: 'const b = "some other product";' },
      // Comments may name the product freely.
      { code: "// Grovetrace mark\nconst c = 1;" },
    ],
    invalid: [
      {
        code: 'const a = "Grovetrace — EUDR Compliance Platform";',
        errors: [{ messageId: "hardcoded" }],
      },
      {
        code: "const b = <span>Grovetrace</span>;",
        errors: [{ messageId: "hardcoded" }],
      },
    ],
  }
);
