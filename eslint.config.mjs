import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  {
    /*
     * Compile-time type assertions are declarations that are never referenced —
     * that is what they are. `tsc` checks them (a violated one fails
     * `npm run typecheck`); ESLint only sees an unused name. Scoped to the one
     * suite that works this way rather than relaxed repository-wide.
     */
    files: ["src/types/__tests__/database-types.test.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
