import { expect, test } from '@playwright/test';

/**
 * E2E onboarding (refonte Conv #28).
 *
 * Flow unifié 4 étapes pour les deux modes :
 *   Profil → Muscles (pinceau + popin équilibre) → Programme → Récap.
 *
 * L'ancienne étape Équilibre est remplacée par une popin au « Suivant »
 * de l'étape 2 (uniquement si R1-R4 détecte des trous). Le préset
 * full-body couvre tous les muscles → pas de popin sur ce chemin.
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

  // Step 2 — Préset par défaut : couverture intégrale → pas de popin.
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('balance-dialog')).toHaveCount(0);
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Step 3 — Custom (default), MEDIUM, NO_PREFERENCE par défaut.
  await expect(page.getByTestId('program-custom')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('duration-medium')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('equip-pref-no_preference')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '4');

  // Step 4 — Récap programme déjà construit.
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

test('popin équilibre : accepter ajoute les muscles en maintien', async ({ page }) => {
  await page.goto('onboarding');
  await page.getByTestId('btn-next').click();

  // Sélection déséquilibrée : pectoraux seuls (push sans pull, pas de core).
  await page.getByTestId('obj-pectoraux-hypertrophie').click();
  await page.getByTestId('btn-next').click();

  await expect(page.getByTestId('balance-dialog')).toBeVisible();
  // R1 suggère au moins un muscle de pull.
  await expect(page.getByTestId('balance-suggestion-dos_largeur')).toBeVisible();
  await page.getByTestId('balance-accept').click();

  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Retour : les muscles acceptés apparaissent en maintien dans la liste.
  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('obj-dos_largeur-maintien')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Re-suivant : la sélection est maintenant équilibrée → pas de popin.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('balance-dialog')).toHaveCount(0);
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');
});

test('popin équilibre : refuser avance sans re-proposer', async ({ page }) => {
  await page.goto('onboarding');
  await page.getByTestId('btn-next').click();

  await page.getByTestId('obj-pectoraux-hypertrophie').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('balance-dialog')).toBeVisible();
  await page.getByTestId('balance-decline').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Aller-retour sans changer la sélection : pas de re-popin.
  await page.getByTestId('btn-prev').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('balance-dialog')).toHaveCount(0);
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');
});

test('bouton retour fonctionnel à chaque étape', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');
  await expect(page.getByTestId('muscle-row-pectoraux')).toBeVisible();

  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  await expect(page.getByTestId('btn-prev')).toBeDisabled();
});

test('parcours avec programme guidé (tableau lignes)', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();

  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();

  // Taper la ligne = sélection + dépliage des détails.
  await page.getByTestId('program-ss').click();
  await expect(page.getByTestId('program-ss')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('program-details-ss')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '4');

  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('préférence machines guidées change l\'orientation du tri', async ({ page }) => {
  await page.goto('onboarding');

  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  // Step 3 — préférence MACHINES.
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
