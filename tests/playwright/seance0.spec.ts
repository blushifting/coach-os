import { expect, test, type Page } from '@playwright/test';

/**
 * E2E Séance 0 — Calibration (Conv #4c).
 *
 * Parcours : onboarding préset full-body custom → /seance-0 → calibrer chaque
 * exo principal en mode "Je teste" → /programme.
 *
 * Couvre aussi : bouton retour entre exos, parcours guidé Starting Strength.
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('coach-os-db');
    } catch {
      /* noop */
    }
  });
});

async function fillSubmaxAndNext(page: Page): Promise<void> {
  // Phase 'measure' : s'assure qu'on est en mode "Je teste", saisit le test.
  await page.getByTestId('tab-submax').click();
  const loadInput = page.getByTestId('input-submax-load');
  if ((await loadInput.count()) > 0) {
    await loadInput.fill('50');
  }
  await page.getByTestId('input-submax-reps').fill('5');
  await page.getByTestId('input-submax-rpe').selectOption('8');
  await expect(page.getByTestId('live-e1rm')).toBeVisible();
  await page.getByTestId('btn-next').click();
  // Phase 'work' : passe à l'exo suivant sans cocher de série (skip working sets).
  await expect(page.getByTestId('work-recap')).toBeVisible();
  await page.getByTestId('btn-work-next').click();
}

async function runOnboardingFullBodyCustom(page: Page): Promise<void> {
  await page.goto('onboarding');
  // Étape 1 — équipement gym complet
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  // Étape 2 — préset full-body
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  // Étape 3 — accepter toutes les suggestions
  await page.getByTestId('btn-next').click();
  // Étape 4 — custom (par défaut)
  await page.getByTestId('btn-next').click();
  // Étape 5 — aperçu (Conv #11b)
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/seance-0$/);
}

test('séance 0 custom : onboarding → calibration → /programme', async ({ page }) => {
  await runOnboardingFullBodyCustom(page);

  await expect(page.getByTestId('seance0-intro')).toBeVisible();
  const totalAttr = await page
    .getByTestId('seance0-page')
    .getAttribute('data-total');
  const total = Number.parseInt(totalAttr ?? '0', 10);
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    await expect(page.getByTestId('calibration-step')).toBeVisible();
    await fillSubmaxAndNext(page);
  }

  await expect(page).toHaveURL(/\/programme$/);
});

test('séance 0 : bouton Précédent permet de corriger un exo', async ({ page }) => {
  await runOnboardingFullBodyCustom(page);

  const total = Number.parseInt(
    (await page.getByTestId('seance0-page').getAttribute('data-total')) ?? '0',
    10,
  );
  test.skip(total < 2, 'besoin d\'au moins 2 exos pour tester le retour');

  // Bouton Précédent désactivé sur le 1er exo (phase measure).
  await expect(page.getByTestId('btn-prev')).toBeDisabled();

  // Valider exo 1.
  await fillSubmaxAndNext(page);
  await expect(page.getByTestId('seance0-page')).toHaveAttribute('data-step', '2');
  await expect(page.getByTestId('calibration-step')).toHaveAttribute('data-phase', 'measure');

  // Retour sur exo 1 (depuis phase measure de l'exo 2).
  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('seance0-page')).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('btn-prev')).toBeDisabled();
});

test('séance 0 : phase work permet de saisir 2 séries et alimente l\'historique', async ({ page }) => {
  await runOnboardingFullBodyCustom(page);

  // Phase measure : test submax.
  await page.getByTestId('tab-submax').click();
  const loadInput = page.getByTestId('input-submax-load');
  if ((await loadInput.count()) > 0) {
    await loadInput.fill('60');
  }
  await page.getByTestId('input-submax-reps').fill('5');
  await page.getByTestId('input-submax-rpe').selectOption('8');
  await page.getByTestId('btn-next').click();

  // Phase work : 2 SetInput visibles, on coche les 2.
  await expect(page.getByTestId('calibration-step')).toHaveAttribute('data-phase', 'work');
  await expect(page.getByTestId('set-row-0')).toBeVisible();
  await expect(page.getByTestId('set-row-1')).toBeVisible();
  await page.getByTestId('toggle-done-0').click();
  await page.getByTestId('toggle-done-1').click();
  await expect(page.getByTestId('set-row-0')).toHaveAttribute('data-done', 'true');

  // Retour à la phase measure puis re-validation : on ne perd pas la possibilité d'avancer.
  await page.getByTestId('btn-work-back').click();
  await expect(page.getByTestId('calibration-step')).toHaveAttribute('data-phase', 'measure');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('calibration-step')).toHaveAttribute('data-phase', 'work');

  // Coche les séries puis passe à l'exo suivant.
  await page.getByTestId('toggle-done-0').click();
  await page.getByTestId('btn-work-next').click();
  await expect(page.getByTestId('seance0-page')).toHaveAttribute('data-step', '2');
});

test('séance 0 guidée Starting Strength : calibration des main_* → /programme', async ({ page }) => {
  await page.goto('onboarding');
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('program-ss').click();
  // Step 4 → 5 (aperçu Conv #11b), puis finalize
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/seance-0$/);

  const total = Number.parseInt(
    (await page.getByTestId('seance0-page').getAttribute('data-total')) ?? '0',
    10,
  );
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    await fillSubmaxAndNext(page);
  }
  await expect(page).toHaveURL(/\/programme$/);
});
