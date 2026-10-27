import { defineConfig, devices } from "@playwright/test";

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a preinstalled Chromium instead of Playwright's own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173",
    // A portrait phone.
    ...devices["Pixel 7"],
    launchOptions: executablePath ? { executablePath } : {},
    // Text appears instantly, so tests don't wait on the typewriter (it has its own test).
    reducedMotion: "reduce",
  },
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
