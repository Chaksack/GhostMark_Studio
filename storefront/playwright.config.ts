/**
 * Playwright configuration for GhostMark storefront E2E suite.
 *
 * Two projects model the chrome the storefront actually ships in:
 *  - desktop-chromium @ 1440x900 covers the lg+ rail (sticky-image PDP,
 *    desktop sticky ATC, mega-menu hover dropdowns).
 *  - mobile-iphone covers the <md compact row (burger overlay, mobile
 *    sticky ATC bar with IntersectionObserver gate).
 *
 * Tests live under `tests/e2e/`. The dev server is NOT auto-started here
 * — running suites assumes either `npm run dev` is up locally or
 * E2E_BASE_URL points at a live deployment. We keep server lifecycle out
 * of the runner so a parallel agent doing a Playwright visual sweep on
 * the same dev server doesn't trip a port collision.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
})
