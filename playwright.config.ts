import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'npx vite --config vite.browser-test.config.ts --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/browser-tests/fixtures/sow-content-display.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
