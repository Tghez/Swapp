import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Rules tests need a running emulator, so they are a separate opt-in
    // project (`npm run test:rules`) rather than part of the default run.
    include: ["tests/unit/**/*.test.ts"],
  },
});
