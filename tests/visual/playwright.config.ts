import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "homepage.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/visual",
  snapshotPathTemplate: "{testDir}/baselines/{platform}/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "Asia/Shanghai",
    colorScheme: "light",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    command: "npm run build:static && npx vite preview --config vite.static.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
