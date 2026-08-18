import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next v16 ships flat configs directly, so they are spread in
// as-is. Do NOT wrap these in @eslint/eslintrc's FlatCompat -- it treats them
// as legacy eslintrc shareable configs and throws
// "Converting circular structure to JSON" while validating them.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // globalIgnores replaces eslint-config-next's default ignores, so the
  // defaults are restated here alongside our own.
  globalIgnores([
    // Defaults from eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // ws-server is a separate package with its own tsconfig (strict: false)
    // and its own dependencies. The root tsconfig already excludes it; keep
    // the lint boundary identical so root linting never depends on it.
    "ws-server/**",
  ]),
]);

export default eslintConfig;
