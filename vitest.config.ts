import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // SettingsModal + userEvent.type chains routinely exceed 5s on slow
    // CI runners because each keystroke triggers a Preact re-render in JSDOM.
    // 10s gives comfortable headroom while still surfacing genuine hangs.
    testTimeout: 10000,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
