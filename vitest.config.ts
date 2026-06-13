import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests live next to source as *.test.ts. E2E specs live under
    // e2e/ and run via Playwright, so keep them out of the Vitest run.
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
