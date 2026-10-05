import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    env: { POSTGRES_URL: "postgres://postgres:postgres@localhost:54329/vendordiff_test" },
    globalSetup: "./vitest.setup.mts",
    fileParallelism: false,
  },
});
