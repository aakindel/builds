import eslint from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import noUnknownCssVars from "./rules/no-unknown-css-vars.mjs";

// Next 16.3 already registers @typescript-eslint for ts/tsx.
// Re-adding typescript-eslint/base throws "Cannot redefine plugin".
// Scope the remaining recommended objects to those files so the
// plugin is present and .mjs/.js files do not get TS-only rules.
const tsRecommended = tseslint.configs.recommended
  .filter((config) => config.name !== "typescript-eslint/base")
  .map((config) => ({
    ...config,
    files: config.files ?? ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
  }));

const eslintConfig = defineConfig([
  ...nextVitals,
  eslint.configs.recommended,
  ...tsRecommended,
  prettier,
  globalIgnores([
    "zlocal/**",
    ".claude/worktrees/**",
    "node_modules/**",
    ".next/**",
    ".next-e2e/**",
    ".next-agent/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".source/**",
    "rules/**/*.test.mjs",
  ]),
  {
    plugins: {
      local: {
        rules: {
          "no-unknown-css-vars": noUnknownCssVars,
        },
      },
    },
    rules: {
      "prefer-const": "error",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "local/no-unknown-css-vars": "warn",
    },
  },
]);

export default eslintConfig;
