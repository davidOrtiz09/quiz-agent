// Load .env so the specs' GROQ_API_KEY skip-check sees the same config the app does —
// without this, `npm run test:e2e` silently skips even with a valid key in .env.
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// When PLAYWRIGHT_BASE_URL is set, the app is already running elsewhere (e.g. the compose
// `dev` service next to the `e2e-ui` container) and Playwright must NOT boot its own copy —
// keeping the test container lean enough to also host Chromium and the UI-mode screencast.
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 240_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Demo mode (see the test:e2e:demo script): PW_CHANNEL=chrome launches the real installed
    // Google Chrome instead of the bundled Chromium, and PW_SLOWMO adds a per-action pause so
    // an audience can follow the clicks. Both are no-ops when unset.
    channel: process.env.PW_CHANNEL,
    launchOptions: { slowMo: Number(process.env.PW_SLOWMO ?? 0) },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
