import { expect, test, type Page } from '@playwright/test';

/**
 * E2E mode démo persona Alex — Conv #13c.
 *
 * Parcours minimal :
 *   1. Onboarding préset par défaut → arrive sur `/programme`.
 *   2. WelcomeBanner affiche le CTA "Voir un exemple…".
 *   3. Clic → enterDemoMode → overlay welcome démo + ExitButton + checklist.
 *   4. Démarrer la visite → overlay disparaît, hint contextuel apparaît.
 *   5. Quitter la démo → backup restauré, on revient au WelcomeBanner.
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

async function runOnboardingMinimal(page: Page): Promise<void> {
  await page.goto('onboarding');
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

test('démo Alex : entrée via WelcomeBanner puis sortie restaure l\'état', async ({
  page,
}) => {
  await runOnboardingMinimal(page);

  // 1. WelcomeBanner visible avec le CTA
  await expect(page.getByTestId('welcome-banner')).toBeVisible();
  const startBtn = page.getByTestId('btn-start-demo-from-welcome');
  await expect(startBtn).toBeVisible();

  // 2. Entrée dans la démo
  await startBtn.click();

  // 3. Overlay welcome + ExitButton + checklist
  await expect(page.getByTestId('demo-welcome-overlay')).toBeVisible();
  await expect(page.getByTestId('btn-exit-demo')).toBeVisible();
  await expect(page.getByTestId('demo-checklist')).toBeVisible();

  // 4. Démarrer la visite — overlay disparaît
  await page.getByTestId('btn-demo-start').click();
  await expect(page.getByTestId('demo-welcome-overlay')).toBeHidden();

  // Hint contextuel /programme visible
  await expect(page.getByTestId('demo-hint-programme')).toBeVisible();

  // 5. Sortie de la démo
  await page.getByTestId('btn-exit-demo').click();
  await expect(page.getByTestId('btn-exit-demo')).toBeHidden();
  await expect(page.getByTestId('demo-checklist')).toBeHidden();

  // Le WelcomeBanner réel revient (snapshot pré-démo restauré)
  await expect(page.getByTestId('welcome-banner')).toBeVisible();
});

test('démo Alex : relance depuis Profil > Aide', async ({ page }) => {
  await runOnboardingMinimal(page);

  // Aller sur Profil via la TabBar
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await page.getByTestId('profil-open-aide').click();
  await expect(page.getByTestId('aide-tuto-demo')).toBeVisible();
  await page.getByTestId('btn-relaunch-demo').click();

  // Démo lancée
  await expect(page.getByTestId('demo-welcome-overlay')).toBeVisible();
  await page.getByTestId('btn-demo-start').click();
  await expect(page.getByTestId('btn-exit-demo')).toBeVisible();
});
