import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    // single shared test DB (teamdocs_test): parallel test files race on the
    // files/file_versions tables (service.test + route tests), so run files
    // sequentially
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
