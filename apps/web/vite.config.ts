import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Budget for the startup chunk: core libs (react-dom, router, query, axios, radix) ≈ 200 kB gzip.
    // Feature-only libraries (charts, PDF, CSV) must be imported from lazy feature routes, not the shell.
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // e2e/ holds the Playwright browser tests.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // Above the 6 s async wait in setup.ts, so a slow first render can still finish.
    testTimeout: 15_000,
    css: false,
    env: { VITE_API_BASE_URL: "http://localhost:3000/api/v1" },
  },
});
