import { defineConfig, devices } from '@playwright/test'

const smokePort = 4173

export default defineConfig({
  testDir: './tests/smoke',
  outputDir: './tests/smoke/.results',
  fullyParallel: false,
  reporter: [['list']],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${smokePort}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview:demo',
    url: `http://127.0.0.1:${smokePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
