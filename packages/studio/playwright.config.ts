import { defineConfig, devices } from "@playwright/test";

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a preinstalled Chromium instead of Playwright's own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "e2e",
  // Tests share one storage folder, so they run in order.
  workers: 1,
  use: {
    baseURL: "http://localhost:4174",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
    reducedMotion: "reduce",
  },
  webServer: {
    command: "pnpm preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
    env: { STUDIO_STORAGE: "../../.storage-e2e" },
  },
});
