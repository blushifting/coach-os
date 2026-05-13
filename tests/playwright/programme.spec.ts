import { expect, test, type Page } from '@playwright/test';

/**
 * E2E Onglet Programme — Conv #5a.
 *
 * Parcours :
 *  - onboarding full-body custom + équip gym
 *  - séance 0 : calibrer chaque exo en "Je teste"
 *  - arrivée sur /programme
 *  - vérifier widgets + calendrier 5×7 + ouverture sheet "Planifier"
 *  - tester /cycle-bilan en standalone (aucun bilan)
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
  }

  await expect(page).toHaveURL(/\/programme$/);
}

test('programme : widgets + calendrier 5×7 + sheet planifier', async ({ page }) => {
  await runOnboardingAndCalibration(page);

  // Dashboard rendu
  await expect(page.getByTestId('programme-page')).toBeVisible();
  await expect(page.getByTestId('programme-widgets')).toBeVisible();

  // Les 4 widgets sont présents
  await expect(page.getByTestId('widget-streak')).toBeVisible();
  await expect(page.getByTestId('widget-week-sessions')).toBeVisible();
  await expect(page.getByTestId('widget-cycle-pct')).toBeVisible();
  await expect(page.getByTestId('widget-next-bilan')).toBeVisible();

  // Calendrier 5 semaines × 7 jours
  await expect(page.getByTestId('condensed-calendar')).toBeVisible();
  for (let w = 1; w <= 5; w++) {
    await expect(page.getByTestId(`week-row-${w}`)).toBeVisible();
  }
  // 35 cases au total
  const cells = page.locator('[data-testid^="day-"]');
  await expect(cells).toHaveCount(35);

  // Au début d'un cycle fresh, le cycle n'est pas terminé : pas de bandeau.
  await expect(page.getByTestId('cycle-finished-banner')).toHaveCount(0);

  // Tap sur la première case de la semaine 1 ouvre la sheet
  const firstCell = page.locator('[data-testid^="day-"]').first();
  await firstCell.click();
  await expect(page.getByTestId('plan-day-sheet-content')).toBeVisible();

  // Fermer la sheet
  await page.getByTestId('plan-day-close').click();
  await expect(page.getByTestId('plan-day-sheet-content')).toHaveCount(0);
});

test('cycle-bilan : page accessible et affiche message vide si pas de bilan', async ({ page }) => {
  await runOnboardingAndCalibration(page);
  await page.goto('cycle-bilan');
  await expect(page.getByTestId('cycle-bilan-page')).toBeVisible();
  await expect(page.getByTestId('bilan-empty')).toBeVisible();
});
