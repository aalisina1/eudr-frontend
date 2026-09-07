import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../../eslint-rules/grovetrace-tokens.mjs";

/**
 * Proof that the token gate can fail (eudr-frontend#128).
 *
 * Same bar as eslint-voice-rules.test.ts and ADR-0027: a lint rule that
 * silently matches nothing would leave the project believing the tokens are
 * enforced while screens drift back to hex literals or Tailwind's named palette, and the last time that
 * drift happened it cost a WCAG failure (#125, 2.12:1 in dark mode).
 *
 * The `valid` cases carry the design of each rule. A rule that flags
 * `bg-success/10`, a raw `"#34D399"` fed to Leaflet, or a token-backed
 * `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` would be reverted within a
 * day. Each of those is pinned here as must-not-fire.
 */

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-hex-in-utility", plugin.rules["no-hex-in-utility"], {
  valid: [
    // The token layer, which is the whole point.
    { code: 'const a = "bg-success/10 text-success-foreground";' },
    { code: "const b = <span className=\"text-destructive\" />;" },
    // A raw hex string is not a Tailwind utility. Leaflet marker colours are
    // fed to a canvas that cannot read CSS variables; they are legitimately
    // fixed and render on tiles, not the card. The rule targets the `-[#…]`
    // arbitrary-value syntax, not the colour itself.
    { code: 'const MARKER = { PASSED: "#34D399", FAILED: "#C23D3D" };' },
    // A token inside the arbitrary syntax is fine: it is not bypassing anything.
    { code: 'const c = "bg-[var(--sidebar)]";' },
    // Comments are never visited.
    { code: "// bg-[#34D399] used to live here\nconst d = 1;" },
  ],
  invalid: [
    { code: 'const a = "bg-[#34D399]";', errors: [{ messageId: "hexUtility" }] },
    { code: 'const b = "text-[#1A6B5A] font-medium";', errors: [{ messageId: "hexUtility" }] },
    // With an opacity modifier, which is how every badge tint was written.
    { code: 'const c = "bg-[#E8C468]/10";', errors: [{ messageId: "hexUtility" }] },
    // In JSX and in a template literal, where several real ones lived.
    { code: "const d = <div className=\"border-[#C7956D]\" />;", errors: [{ messageId: "hexUtility" }] },
    { code: "const e = `rounded ${x} from-[#0B1D1C]`;", errors: [{ messageId: "hexUtility" }] },
    // Short hex and 8-digit hex too.
    { code: 'const f = "bg-[#fff]";', errors: [{ messageId: "hexUtility" }] },
    { code: 'const g = "bg-[#34D39980]";', errors: [{ messageId: "hexUtility" }] },
  ],
});

ruleTester.run("no-palette-utility", plugin.rules["no-palette-utility"], {
  valid: [
    // The tokens, which is the whole point.
    { code: 'const a = "bg-success/10 text-success-foreground";' },
    { code: 'const b = <span className="text-primary hover:text-primary/80" />;' },
    { code: 'const c = "bg-muted text-muted-foreground border-border";' },
    // Colour keywords that are not the palette.
    { code: 'const d = "bg-white text-black border-transparent text-current";' },
    // A word that happens to end in a palette-looking token but is not a colour
    // utility: a data attribute, a translation key, a test id.
    { code: 'const e = "data-red-500 tone-amber-100";' },
    { code: 'const f = { key: "shipments.rag.red-700" };' },
    // Comments are never visited.
    { code: "// text-emerald-700 used to live here\nconst g = 1;" },
  ],
  invalid: [
    { code: 'const a = "text-emerald-700";', errors: [{ messageId: "paletteUtility" }] },
    { code: 'const b = "bg-amber-100 text-amber-700";', errors: [{ messageId: "paletteUtility" }] },
    // The dark: twin, which is how every one of these hid from the theme.
    { code: 'const c = "dark:bg-emerald-900/30";', errors: [{ messageId: "paletteUtility" }] },
    { code: 'const d = "hover:text-red-600";', errors: [{ messageId: "paletteUtility" }] },
    // The 50 and 950 ends of the scale, and an opacity modifier.
    { code: 'const e = "bg-emerald-50/50";', errors: [{ messageId: "paletteUtility" }] },
    { code: 'const f = "border-slate-950";', errors: [{ messageId: "paletteUtility" }] },
    // In JSX and in a template literal.
    { code: 'const g = <div className="bg-blue-600 hover:bg-blue-700" />;', errors: [{ messageId: "paletteUtility" }] },
    { code: "const h = `px-2 ${x} text-blue-500`;", errors: [{ messageId: "paletteUtility" }] },
  ],
});

ruleTester.run("no-arbitrary-font-size", plugin.rules["no-arbitrary-font-size"], {
  valid: [
    { code: 'const a = "text-xs text-muted-foreground";' },
    { code: 'const b = "text-sm font-medium";' },
    { code: 'const c = "text-4xl";' },
    // Arbitrary *colour* on text is the other rule's job, not this one's.
    { code: 'const d = "text-[var(--x)]";' },
    // Not a font size.
    { code: 'const e = "max-w-[200px]";' },
  ],
  invalid: [
    { code: 'const a = "text-[13px]";', errors: [{ messageId: "arbitrarySize" }] },
    // The half-pixel tell.
    { code: 'const b = "text-[12.5px]";', errors: [{ messageId: "arbitrarySize" }] },
    { code: 'const c = "text-[0.8125rem]";', errors: [{ messageId: "arbitrarySize" }] },
    { code: "const d = <p className=\"text-[11px] uppercase\" />;", errors: [{ messageId: "arbitrarySize" }] },
  ],
});

ruleTester.run("no-arbitrary-shadow", plugin.rules["no-arbitrary-shadow"], {
  valid: [
    { code: 'const a = "shadow-card";' },
    { code: 'const b = "shadow-md hover:shadow-lg";' },
    // A shadow whose value is a token is not a bypass. shadcn's sidebar uses
    // this for a hairline ring in the sidebar's own colours.
    { code: 'const c = "shadow-[0_0_0_1px_hsl(var(--sidebar-border))]";' },
    { code: 'const d = "shadow-[var(--shadow-card)]";' },
  ],
  invalid: [
    { code: 'const a = "shadow-[0_1px_3px_rgba(0,0,0,0.04)]";', errors: [{ messageId: "arbitraryShadow" }] },
    // The literal value of --shadow-card, written out by hand. This one was real.
    {
      code: 'const b = "shadow-[0_1px_2px_rgba(11,29,28,0.04),0_10px_26px_-18px_rgba(11,29,28,0.14)]";',
      errors: [{ messageId: "arbitraryShadow" }],
    },
    { code: "const c = <div className=\"hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]\" />;", errors: [{ messageId: "arbitraryShadow" }] },
  ],
});
