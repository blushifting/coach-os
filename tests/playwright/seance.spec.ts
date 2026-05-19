import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Séance — Conv #5b (helper Séance 0 retiré post-#12a).
 *
 * Parcours :
 *  - onboarding minimal → /programme
 *  - /seance État A → bouton "Commencer" → État B (runner)
 *  - valider quelques sets → "Terminer" → bilan (État C)
 *  - retour au programme
 *  - depuis /programme : tap case libre → sheet → "Démarrer" → /seance État B
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

test('seance : start list → runner → terminer → bilan → retour', async ({ page }) => {
  await runOnboardingMinimal(page);

  // Nav vers /seance via TabBar
  await page.getByRole('link', { name: 'Séance' }).click();
  await expect(page).toHaveURL(/\/seance$/);

  // État A : la liste de démarrage
  await expect(page.getByTestId('start-session-list')).toBeVisible();
  await page.getByTestId('start-day-0').click();

  // État B : runner
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
  await page.getByRole('link', { name: 'Séance' }).click();
  await page.getByTestId('start-day-0').click();
  await expect(page.getByTestId('session-runner')).toBeVisible();

  await page.getByTestId('btn-detail-0').click();
  await expect(page.getByTestId('exercise-detail-content')).toBeVisible();
});

test('programme → PlanDaySheet → Démarrer → /seance runner', async ({ page }) => {
  await runOnboardingMinimal(page);

  // Cherche la 1re case "free-future" cliquable.
  const future = page.locator('[data-testid^="day-"][data-status="free-future"]').first();
  await future.click();
  await expect(page.getByTestId('plan-day-sheet-content')).toBeVisible();

  // Démarrer le 1er slot
  await page.getByTestId('plan-slot-0').click();
  await expect(page).toHaveURL(/\/seance$/);
  await expect(page.getByTestId('session-runner')).toBeVisible();
});
