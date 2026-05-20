import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E mode démo persona Alex — Conv #13e (refonte tour guidé).
 *
 * Parcours :
 *   1. Onboarding préset par défaut → arrive sur `/programme`.
 *   2. WelcomeBanner CTA → enterDemoMode → overlay welcome démo.
 *   3. Commencer la visite → bandeau étape 1 (Programme).
 *   4. Suivant × N → on traverse les 6 étapes, chacune sur sa route.
 *   5. Démarrer ma vraie 1re séance → exit + retour /programme.
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
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
  });
});

test("démo Alex : tour guidé complet 6 étapes + sortie", async ({ page }) => {
  await runOnboardingMinimal(page);

  // 1. WelcomeBanner CTA → entrée démo
  await expect(page.getByTestId('welcome-banner')).toBeVisible();
  await page.getByTestId('btn-start-demo-from-welcome').click();

  // 2. Overlay welcome + ExitButton (mais pas encore le bandeau du tour)
  await expect(page.getByTestId('demo-welcome-overlay')).toBeVisible();
  await expect(page.getByTestId('btn-exit-demo')).toBeVisible();

  // 3. Démarrer la visite → étape 1 = Programme
  await page.getByTestId('btn-demo-start').click();
  await expect(page.getByTestId('demo-welcome-overlay')).toBeHidden();
  await expect(page.getByTestId('demo-tour-step-programme')).toBeVisible();
  await expect(page).toHaveURL(/\/programme$/);

  // 4. Suivant → étape 2 = Séance
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-seance')).toBeVisible();
  await expect(page).toHaveURL(/\/seance\/runner$/);

  // 5. Suivant → étape 3 = Force (sur /progres, sous-onglet "force" auto-cliqué)
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-progres-force')).toBeVisible();
  await expect(page).toHaveURL(/\/progres$/);

  // 6. Suivant → étape 4 = Bilan de cycle
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-cycle-bilan')).toBeVisible();
  await expect(page).toHaveURL(/\/cycle-bilan$/);

  // 7. Suivant → étape 5 = Profil
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-profil')).toBeVisible();
  await expect(page).toHaveURL(/\/profil$/);

  // 8. Suivant → étape 6 = Sortie (bouton Démarrer ma vraie 1re séance)
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-done')).toBeVisible();
  await expect(page.getByTestId('btn-tour-finish')).toBeVisible();

  // 9. Finish → exit + retour programme + welcome banner restauré
  await page.getByTestId('btn-tour-finish').click();
  await expect(page.getByTestId('btn-exit-demo')).toBeHidden();
  await expect(page).toHaveURL(/\/programme$/);
  await expect(page.getByTestId('welcome-banner')).toBeVisible();
});

test('démo Alex : bouton Précédent revient à l\'étape précédente', async ({
  page,
}) => {
  await runOnboardingMinimal(page);
  await page.getByTestId('btn-start-demo-from-welcome').click();
  await page.getByTestId('btn-demo-start').click();

  // Étape 1 → 2 → retour 1 via Précédent
  await page.getByTestId('btn-tour-next').click();
  await expect(page.getByTestId('demo-tour-step-seance')).toBeVisible();
  await expect(page).toHaveURL(/\/seance\/runner$/);
  await page.getByTestId('btn-tour-prev').click();
  await expect(page.getByTestId('demo-tour-step-programme')).toBeVisible();
  await expect(page).toHaveURL(/\/programme$/);
});

test('démo Alex : Quitter la démo à mi-parcours restaure l\'état', async ({
  page,
}) => {
  await runOnboardingMinimal(page);
  await page.getByTestId('btn-start-demo-from-welcome').click();
  await page.getByTestId('btn-demo-start').click();

  // Avance de 2 étapes puis quitte
  await page.getByTestId('btn-tour-next').click();
  await page.getByTestId('btn-tour-next').click();
  await page.getByTestId('btn-exit-demo').click();

  await expect(page.getByTestId('btn-exit-demo')).toBeHidden();
  // Une relance redémarre à l'étape 1 (pas de reprise mi-parcours)
  await page.getByRole('link', { name: 'Programme' }).click();
  await expect(page).toHaveURL(/\/programme$/);
  await page.getByTestId('btn-start-demo-from-welcome').click();
  await page.getByTestId('btn-demo-start').click();
  await expect(page.getByTestId('demo-tour-step-programme')).toBeVisible();
});

test('démo Alex : relance depuis Profil > Aide', async ({ page }) => {
  await runOnboardingMinimal(page);

  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await page.getByTestId('profil-open-aide').click();
  await expect(page.getByTestId('aide-tuto-demo')).toBeVisible();
  await page.getByTestId('btn-relaunch-demo').click();

  await expect(page.getByTestId('demo-welcome-overlay')).toBeVisible();
  await page.getByTestId('btn-demo-start').click();
  await expect(page.getByTestId('demo-tour-step-programme')).toBeVisible();
});
