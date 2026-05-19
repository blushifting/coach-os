import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Programme — Conv #5a (helper Séance 0 retiré post-#12a).
 *
 * Parcours :
 *  - onboarding full-body custom + équip gym → /programme direct
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

test('programme : widgets + calendrier 5×7 + sheet planifier', async ({ page }) => {
  await runOnboardingMinimal(page);

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
  await runOnboardingMinimal(page);
  await page.goto('cycle-bilan');
  await expect(page.getByTestId('cycle-bilan-page')).toBeVisible();
  await expect(page.getByTestId('bilan-empty')).toBeVisible();
});
