import { expect, type Page } from '@playwright/test';

/**
 * Onboarding minimal post-#12a (Conv #13 / fix Séance 0).
 *
 * La Séance 0 dédiée a été retirée en Conv #12a — l'onboarding navigue
 * directement vers `/programme`, et les plafonds sont bootstrappés à la
 * 1re séance via heuristique bw-based puis raffinés par feedback RPE.
 *
 * Ce helper remplace l'ancien `runOnboardingAndCalibration` qui était
 * dupliqué dans 5+ specs. Il fait le parcours minimal préset par défaut +
 * équip gym, puis vérifie l'arrivée sur `/programme`.
 */
export async function runOnboardingMinimal(page: Page): Promise<void> {
  await page.goto('onboarding');
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

/**
 * Vide la DB IndexedDB + localStorage avant chaque test. À placer dans
 * `test.beforeEach(({ context }) => clearDbBeforeTest(context))`.
 */
export function clearDbInitScript(): string {
  return `
    try { indexedDB.deleteDatabase('coach-os'); } catch {}
    try { indexedDB.deleteDatabase('coach-os-db'); } catch {}
    try { localStorage.clear(); } catch {}
  `;
}
