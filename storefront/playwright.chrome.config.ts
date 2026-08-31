/**
 * QA-lane fallback config: run the suite against the LOCALLY INSTALLED
 * Google Chrome instead of Playwright's bundled browsers.
 *
 * WHY THIS FILE EXISTS
 * `playwright.config.ts` is correct and should not change. But this
 * machine cannot currently run it: the repo is on @playwright/test
 * 1.59.1, which wants `chromium-1217` and `webkit-2272`, and the browser
 * cache holds only `chromium-1169` (July 2025). Every one of the 32
 * tests in the existing suite therefore fails with
 * "browserType.launch: Executable doesn't exist", i.e. the suite has
 * never actually executed on this machine. `npx playwright install`
 * stalls here (448KB in five minutes against cdn.playwright.dev), so
 * downloading is not currently a route to a green baseline.
 *
 * Google Chrome 152 IS installed, and `channel: 'chrome'` drives it
 * directly with no download. That gets the suite running today.
 *
 * WHAT THIS COSTS, STATED PLAINLY
 *  - `mobile-chrome-390` is Chrome with an iPhone 14 viewport and touch
 *    emulation. It is NOT WebKit. It covers layout, geometry, hit
 *    testing and overflow faithfully, which is what the suites in this
 *    directory assert. It does NOT cover WebKit-specific rendering or
 *    Safari-only bugs. Any result from this project is evidence about
 *    390px layout, not about iOS Safari.
 *  - Chrome auto-updates, so this is a moving baseline in a way the
 *    pinned bundled browsers are not.
 *
 * The moment `npx playwright install` succeeds on this machine, prefer
 * `playwright.config.ts`. This is a bridge, not a replacement.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Capped: four other agents are driving browsers on this machine right
  // now, and an unbounded worker pool starves them (and produces the
  // flaky timeouts that get misread as product defects).
  workers: 3,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-qa', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      // Name kept as `mobile-iphone` on purpose: the existing specs gate
      // themselves with `test.skip(testInfo.project.name !== 'mobile-iphone')`,
      // and renaming it would silently skip every mobile test in the
      // repo — a green run that proves nothing.
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 14'],
        // Override the descriptor's `defaultBrowserType: 'webkit'`.
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
  ],
})
