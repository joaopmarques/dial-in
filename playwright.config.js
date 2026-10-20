import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 800 } },
});
