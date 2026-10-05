import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    // single shared test DB (teamkb_test): run test files sequentially
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
