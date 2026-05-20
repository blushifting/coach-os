import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E runner séance — Conv #14b-1 (onglet "Séance" supprimé).
 *
 * Le démarrage passe désormais 100 % par le `PlanDaySheet` du Programme :
 *  - tap sur un jour libre d'aujourd'hui → "Démarrer" → /seance/runner
 *  - cocher / saisir → "Terminer" → bilan
 *  - bouton "Retour programme" → /programme
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

test('seance : depuis programme → runner → terminer → bilan → retour', async ({ page }) => {
  await runOnboardingMinimal(page);

  // 1re case "free-future" cliquable (typiquement aujourd'hui après onboarding).
  const future = page.locator('[data-testid^="day-"][data-status="free-future"]').first();
  await future.click();
  await expect(page.getByTestId('plan-day-sheet-content')).toBeVisible();

  // Démarrer le 1er slot du programme (jour d'aujourd'hui → start immédiat).
  await page.getByTestId('plan-slot-0').click();
  await expect(page).toHaveURL(/\/seance\/runner$/);
  await expect(page.getByTestId('session-runner')).toBeVisible();
  await expect(page.getByTestId('session-progress')).toBeVisible();

  // Au moins 1 exo et 1 set
  const firstSet = page.getByTestId('set-row-0').first();
  await expect(firstSet).toBeVisible();

  // Valider la 1re série du 1er exo
  await page.getByTestId('toggle-done-0').first().click();
  await expect(page.getByTestId('set-row-0').first()).toHaveAttribute('data-done', 'true');

  // Terminer la séance
  await page.getByTestId('btn-finish-session').click();

  // État C : bilan
  await expect(page.getByTestId('session-summary')).toBeVisible();
  await expect(page.getByTestId('summary-volume')).toBeVisible();
  await expect(page.getByTestId('summary-prs')).toBeVisible();

  // Retour programme
  await page.getByTestId('btn-back-programme').click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('seance : détail exo affiche le nom + muscles', async ({ page }) => {
  await runOnboardingMinimal(page);
  const future = page.locator('[data-testid^="day-"][data-status="free-future"]').first();
  await future.click();
  await page.getByTestId('plan-slot-0').click();
  await expect(page.getByTestId('session-runner')).toBeVisible();

  await page.getByTestId('btn-detail-0').click();
  await expect(page.getByTestId('exercise-detail-content')).toBeVisible();
});

test('seance : /seance redirige vers /programme (compat)', async ({ page }) => {
  await runOnboardingMinimal(page);
  await page.goto('seance');
  await expect(page).toHaveURL(/\/programme$/);
});
