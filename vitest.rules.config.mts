import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Rules tests need the Firestore emulator running, so they live in their own
 * config rather than the default `npm test` run:
 *
 *   npm run emulators
 *   npm run test:rules
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    // Rules tests share one emulator instance and clear it between cases, so
    // they must not run concurrently.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
