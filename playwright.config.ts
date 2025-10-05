import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  timeout: 60000,
  fullyParallel: false, // Run tests sequentially for MCP server
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only one worker since we're starting/stopping server
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
})
