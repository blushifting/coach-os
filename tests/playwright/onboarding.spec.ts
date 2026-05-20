import { expect, test } from '@playwright/test';

/**
 * E2E onboarding (Conv #4b, redirection finale mise à jour Conv #4c, étape
 * Aperçu ajoutée Conv #11b).
 *
 * Parcours complet : Profil → Muscles (préset) → Équilibre R1-R4 → Programme
 * → Aperçu (Conv #11b) → finalisation → /programme (post-#12a : Séance 0 retirée).
 *
 * Garde-fou aussi testé : impossible de passer 2 → 3 sans muscle sélectionné.
 */

test.beforeEach(async ({ context }) => {
  // Isolation : on vide IndexedDB pour démarrer "vierge" à chaque test.
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('coach-os-db');
    } catch {
      /* noop */
    }
  });
});

test('parcours complet : préset par défaut → custom → /programme', async ({ page }) => {
  await page.goto('onboarding');
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  // === Étape 1 : profil ===
  await page.getByTestId('sex-homme').click();
  await page.getByTestId('level-debutant').click();
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');

  // === Étape 2 : préset par défaut (full-body) ===
  await page.getByTestId('preset-default').click();
  await expect(page.getByTestId('priorities-list')).toBeVisible();
  await expect(page.getByTestId('priority-pectoraux')).toBeVisible();
  await expect(page.getByTestId('priority-quadriceps')).toBeVisible();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // === Étape 3 : suggestions R1-R4 (toutes pré-cochées) ===
  await expect(page.getByTestId('suggestions-list')).toBeVisible();
  // R3 gainage : abdos + lombaires doivent apparaître
  await expect(page.getByTestId('suggestion-abdos')).toBeVisible();
  await expect(page.getByTestId('suggestion-lombaires')).toBeVisible();
  // R4 : deltos_posterieurs (pectoraux est PRIORITAIRE dans le préset)
  await expect(page.getByTestId('suggestion-deltos_posterieurs')).toBeVisible();
  // Décocher une suggestion pour tester l'override → NON_COUVERT
  await page.getByTestId('suggestion-checkbox-lombaires').click();
  await expect(page.getByTestId('suggestion-checkbox-lombaires')).not.toBeChecked();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '4');

  // === Étape 4 : choix custom (default) ===
  await expect(page.getByTestId('program-custom')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  // === Étape 5 : aperçu programme (Conv #11b) ===
  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await expect(page.getByTestId('volume-recap')).toBeVisible();

  // Finaliser
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});

test('garde-fou : impossible d\'avancer étape 2 sans muscle', async ({ page }) => {
  await page.goto('onboarding');

  // Étape 1 minimal
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');

  // Pas de muscle sélectionné → bouton Suivant déclenche une erreur, on reste à l'étape 2.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');
  await expect(page.getByTestId('onboarding-error')).toBeVisible();
});

test('bouton retour fonctionnel à chaque étape', async ({ page }) => {
  await page.goto('onboarding');

  // 1 → 2 → 3
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '3');

  // Retour 3 → 2
  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '2');
  // Les priorités du préset sont conservées
  await expect(page.getByTestId('priority-pectoraux')).toBeVisible();

  // Retour 2 → 1
  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '1');

  // Bouton Précédent désactivé à l'étape 1
  await expect(page.getByTestId('btn-prev')).toBeDisabled();
});

test('parcours avec programme guidé', async ({ page }) => {
  await page.goto('onboarding');

  // Étape 1 : 3 séances/sem (compatible Starting Strength)
  await page.getByTestId('level-debutant').click();
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();

  // Étape 2 : préset par défaut
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();

  // Étape 3 : on accepte tout par défaut
  await page.getByTestId('btn-next').click();

  // Étape 4 : Starting Strength
  await page.getByTestId('program-ss').click();
  await expect(page.getByTestId('program-ss')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('onboarding-page')).toHaveAttribute('data-step', '5');

  // Étape 5 : aperçu, on valide directement
  await expect(page.getByTestId('step5-preview')).toBeVisible();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
});
