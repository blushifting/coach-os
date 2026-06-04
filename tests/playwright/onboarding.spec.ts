import { expect, test } from '@playwright/test';

/**
 * E2E onboarding (refonte Conv #22.2).
 *
 * Flow unifié 5 étapes pour les deux modes :
 *   Profil → Muscles → Équilibre → Programme → Récap.
 *
 * Step1 ne contient plus que sexe/âge/poids. Step4 ajoute durée max
 * + préférence équipement. Le mode custom auto-fill les exos via la
 * préférence ; l'user swap dans le récap final.
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

test('parcours custom : préset → récap auto-fillé → /programme', async ({ page }) => {
  await page.goto('onboarding');
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  // Step 1 — défaut (sexe homme, etc.).
  await page.getByTestId('sex-homme').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');

  // Step 2 — Préset par défaut.
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Step 3 — Suggestions R1-R4 pré-cochées.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '4');

  // Step 4 — Custom (default), MEDIUM, NO_PREFERENCE par défaut.
  await expect(page.getByTestId('program-custom')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('duration-medium')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('equip-pref-no_preference')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  // Step 5 — Récap programme déjà construit.
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

test('parcours avec programme guidé', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();

  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();

  await page.getByTestId('btn-next').click();

  await page.getByTestId('program-ss').click();
  await expect(page.getByTestId('program-ss')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('préférence machines guidées change l\'orientation du tri', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  // Step 4 — préférence MACHINES.
  await page.getByTestId('equip-pref-machines').click();
  await expect(page.getByTestId('equip-pref-machines')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});
