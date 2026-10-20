import { defineConfig, devices } from '@playwright/test'

const gpu = { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] }

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4281/', locale: 'pt-BR', launchOptions: gpu },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4281 --strictPort',
    url: 'http://localhost:4281/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: gpu } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: gpu } },
  ],
})
