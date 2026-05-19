import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Progrès — Conv #6a (helper Séance 0 retiré post-#12a).
 *
 * Couvre :
 *  - onboarding minimal → /programme
 *  - bascule vers /progres via TabBar
 *  - 3 tabs Couverture / Volume / Cycles présents + bascule
 *  - vue Cycles : état vide tant qu'aucun bilan n'a été produit
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

test('progres : 3 tabs Couverture / Volume / Cycles et bascule entre eux', async ({ page }) => {
  await runOnboardingMinimal(page);

  // Navigation SPA via la TabBar pour préserver l'état du store hydraté à
  // l'onboarding (cf. bug connu : `bootstrap()` n'est pas appelé en arrivée
  // directe sur /progres, hors scope Conv #6a).
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page).toHaveURL(/\/progres$/);
  await expect(page.getByTestId('progres-page')).toBeVisible();

  // Tabs présents
  await expect(page.getByTestId('progres-tabs')).toBeVisible();
  await expect(page.getByTestId('tab-couverture')).toBeVisible();
  await expect(page.getByTestId('tab-volume')).toBeVisible();
  await expect(page.getByTestId('tab-cycles')).toBeVisible();

  // Vue par défaut = Couverture, grille chips visible
  await expect(page.getByTestId('panel-couverture')).toBeVisible();
  await expect(page.getByTestId('coverage-view')).toBeVisible();
  await expect(page.getByTestId('coverage-grid')).toBeVisible();

  // Bascule Volume
  await page.getByTestId('tab-volume').click();
  await expect(page.getByTestId('panel-volume')).toBeVisible();
  await expect(page.getByTestId('volume-view')).toBeVisible();

  // Bascule Cycles : aucun cycle terminé → état vide
  await page.getByTestId('tab-cycles').click();
  await expect(page.getByTestId('panel-cycles')).toBeVisible();
  await expect(page.getByTestId('cycles-empty')).toBeVisible();

  // Retour Couverture
  await page.getByTestId('tab-couverture').click();
  await expect(page.getByTestId('coverage-view')).toBeVisible();
});
