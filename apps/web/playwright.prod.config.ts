import { defineConfig, devices } from "@playwright/test";

/**
 * Plan #11 — production-build E2E harness for Serwist offline mode.
 * Serwist is disabled when NODE_ENV === "development", so SW behavior can
 * only be verified against a real `next start` server.
 *
 * Run: PW_PROD=1 npx playwright test --config=playwright.prod.config.ts
 *   (PowerShell: $env:PW_PROD="1"; npx playwright test --config=playwright.prod.config.ts)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
