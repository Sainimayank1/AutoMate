import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // public/sw.js runs in a service worker, not the page: plain JS outside the app's TypeScript.
  globalIgnores(["dist", "coverage", "public/sw.js"]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    plugins: { "simple-import-sort": simpleImportSort },
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // shadcn primitives export variants/hooks next to components.
    files: ["src/components/ui/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
]);
