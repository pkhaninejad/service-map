import { defineConfig } from "vitest/config";

// Unit tests for pure app logic (e.g. the license client). Kept separate from
// the Vite app build; test files are excluded from tsconfig.app.json.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
