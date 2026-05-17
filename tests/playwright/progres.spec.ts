import { expect, test, type Page } from '@playwright/test';

/**
 * E2E Onglet Progrès — Conv #6a.
 *
 * Couvre :
 *  - navigation onboarding + séance 0 + arrivée sur /programme
 *  - bascule vers /progres
 *  - 3 tabs Couverture / Volume / Cycles présents
 *  - vue par défaut = Couverture, avec sa grille de chips muscles
 *  - bascule entre tabs (clic sur tab-volume, tab-cycles)
 *  - vue Cycles montre l'état vide tant qu'aucun bilan n'a été produit
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

async function runOnboardingAndCalibration(page: Page): Promise<void> {
  await page.goto('onboarding');
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/seance-0$/);

  const totalAttr = await page.getByTestId('seance0-page').getAttribute('data-total');
  const total = Number.parseInt(totalAttr ?? '0', 10);
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    await page.getByTestId('tab-submax').click();
    const loadInput = page.getByTestId('input-submax-load');
    if ((await loadInput.count()) > 0) {
      await loadInput.fill('50');
    }
    await page.getByTestId('input-submax-reps').fill('5');
    await page.getByTestId('input-submax-rpe').selectOption('8');
    await page.getByTestId('btn-next').click();
    await page.getByTestId('btn-work-next').click();
  }

  await expect(page).toHaveURL(/\/programme$/);
}

test('progres : 3 tabs Couverture / Volume / Cycles et bascule entre eux', async ({ page }) => {
  await runOnboardingAndCalibration(page);

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
