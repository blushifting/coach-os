import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Progrès — Conv #6a (refondu Conv #17).
 *
 * Conv #17 : fusion Couverture + Volume en un seul onglet "Volume" (silhouette
 * cliquable + courbes d'évolution par muscle). 3 tabs au lieu de 4.
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('coach-os');
      indexedDB.deleteDatabase('coach-os-db');
    } catch {
      /* noop */
    }
  });
});

test('progres : 3 tabs Volume / Force / Cycles et bascule entre eux', async ({ page }) => {
  await runOnboardingMinimal(page);

  // Navigation SPA via la TabBar pour préserver l'état du store hydraté à
  // l'onboarding (cf. bug connu : `bootstrap()` n'est pas appelé en arrivée
  // directe sur /progres, hors scope Conv #6a).
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page).toHaveURL(/\/progres$/);
  await expect(page.getByTestId('progres-page')).toBeVisible();

  // Tabs présents
  await expect(page.getByTestId('progres-tabs')).toBeVisible();
  await expect(page.getByTestId('tab-volume')).toBeVisible();
  await expect(page.getByTestId('tab-force')).toBeVisible();
  await expect(page.getByTestId('tab-cycles')).toBeVisible();

  // Vue par défaut = Volume (silhouette + cards)
  await expect(page.getByTestId('panel-volume')).toBeVisible();
  await expect(page.getByTestId('volume-view')).toBeVisible();
  await expect(page.getByTestId('volume-silhouette')).toBeVisible();

  // Bascule Cycles : aucun cycle terminé → état vide
  await page.getByTestId('tab-cycles').click();
  await expect(page.getByTestId('panel-cycles')).toBeVisible();
  await expect(page.getByTestId('cycles-empty')).toBeVisible();

  // Retour Volume
  await page.getByTestId('tab-volume').click();
  await expect(page.getByTestId('volume-view')).toBeVisible();
});
