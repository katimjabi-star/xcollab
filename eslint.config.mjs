import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "**/.next/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      complexity: ["error", 15],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // The i18n dictionary is data, not logic: it grows one line per string
    // per language and splitting it would break the EN/AR parity test's
    // single-source shape. Cap it generously instead of exempting entirely.
    files: ["apps/web/lib/i18n.ts"],
    rules: {
      "max-lines": ["error", { max: 1000, skipBlankLines: true, skipComments: true }],
    },
  },
);
