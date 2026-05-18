import { defineConfig, devices } from '@playwright/test';

// Config Playwright (Conv #4b — Onboarding e2e).
//
// - testDir: tests/playwright — isolé des tests Vitest (tests/<glob>.test.ts).
// - webServer : Vite dev (npm run dev, port 5173). Vite base = /coach-os/,
//   donc baseURL doit inclure ce préfixe.
// - Chromium only en V1 (suffisant pour valider un parcours mobile-first).
export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Conv #11d — parallélisation activée. Chaque test Playwright crée son
  // propre browserContext isolé (comportement par défaut), donc aucun
  // partage d'IndexedDB entre tests. 4 workers cible une machine de dev
  // classique ; sur CI ou machine plus modeste, baisser à 2.
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: 'http://localhost:5173/coach-os/',
    trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 }, // iPhone 14 portrait
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/coach-os/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
