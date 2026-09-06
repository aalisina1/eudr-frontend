import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import grovetraceVoice from "./eslint-rules/grovetrace-voice.mjs";
import grovetraceTokens from "./eslint-rules/grovetrace-tokens.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The product voice, enforced where the string is typed (ADR-0027).
  // Scoped to src/ — e2e specs assert on the copy as it is, so a spec quoting
  // an em dash it must match is correct, not a violation.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "grovetrace-voice": grovetraceVoice, "grovetrace-tokens": grovetraceTokens },
    rules: {
      "grovetrace-voice/no-em-dash": "error",
      "grovetrace-voice/no-us-spelling": "error",
      "grovetrace-voice/require-date-locale": "error",
      "grovetrace-voice/product-name-from-brand-module": "error",
      // The design tokens (ADR-0027 applied to globals.css; #128). The first
      // prevents a WCAG failure, not a style drift.
      "grovetrace-tokens/no-hex-in-utility": "error",
      "grovetrace-tokens/no-arbitrary-font-size": "error",
      "grovetrace-tokens/no-arbitrary-shadow": "error",
    },
  },
]);

export default eslintConfig;
