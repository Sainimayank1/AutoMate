import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC (not esbuild) so Nest's decorator metadata is emitted for dependency injection.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["**/*.spec.ts", "**/*.e2e-spec.ts"],
    setupFiles: ["test/setup-env.ts"],
  },
});
