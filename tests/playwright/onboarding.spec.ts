import { expect, test } from '@playwright/test';

/**
 * E2E onboarding (refonte Conv #22).
 *
 * Parcours :
 *   - Mode guidé : Profil → Muscles → Équilibre → Programme guidé → Récap.
 *   - Mode custom co-construit : ajoute Squelette → Variantes avant le récap.
 *
 * Step1 ne contient plus que sexe/âge/poids (Conv #22 retrait niveau et
 * équipement). Step4 ajoute le sélecteur durée max (default MEDIUM).
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('coach-os-db');
    } catch {
      /* noop */
    }
    try {
      localStorage.setItem('coach-os.skip-auto-demo', '1');
    } catch {
      /* noop */
    }
  });
});

test('parcours custom co-construit : préset → squelette → variantes → récap', async ({
  page,
}) => {
  await page.goto('onboarding');
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  // Step 1 — Profil (sexe seulement à cliquer, le reste a des défauts).
  await page.getByTestId('sex-homme').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');

  // Step 2 — Préset par défaut.
  await page.getByTestId('preset-default').click();
  await expect(page.getByTestId('priorities-list')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Step 3 — Suggestions R1-R4 toutes pré-cochées.
  await expect(page.getByTestId('suggestions-list')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '4');

  // Step 4 — Custom (default) + MEDIUM duration default.
  await expect(page.getByTestId('program-custom')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('duration-medium')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  // Step 5 — Squelette (Conv #22), lecture seule.
  await expect(page.getByTestId('step5-skeleton')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '6');

  // Step 6 — Variantes (auto-fill au mount + grille 3-cols).
  await expect(page.getByTestId('step6-variants')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '7');

  // Step 7 — Récap final.
  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});

test("garde-fou : impossible d'avancer étape 2 sans muscle", async ({ page }) => {
  await page.goto('onboarding');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');

  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');
  await expect(page.getByTestId('onboarding-error')).toBeVisible();
});

test('bouton retour fonctionnel à chaque étape', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');
  await expect(page.getByTestId('priority-pectoraux')).toBeVisible();

  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  await expect(page.getByTestId('btn-prev')).toBeDisabled();
});

test('parcours avec programme guidé (5 étapes)', async ({ page }) => {
  await page.goto('onboarding');

  // Step 1 minimal.
  await page.getByTestId('btn-next').click();

  // Step 2.
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();

  // Step 3.
  await page.getByTestId('btn-next').click();

  // Step 4 — Starting Strength.
  await page.getByTestId('program-ss').click();
  await expect(page.getByTestId('program-ss')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  // Step 5 — Récap direct (mode guidé saute squelette/variantes).
  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});
