import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: 'http://localhost:3100',
    actionTimeout: 15000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { channel: 'chrome' },
  },
  webServer: [
    {
      command: 'node tests/e2e/backend.mjs',
      url: 'http://127.0.0.1:54329/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --port 3100',
      url: 'http://localhost:3100/login',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key-only',
      },
    },
  ],
});
