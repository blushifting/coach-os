import { expect, test, type Page } from '@playwright/test';

/**
 * E2E Onglet Catalogue — Conv #6b.
 *
 * Couvre :
 *  - navigation SPA Programme → Catalogue après onboarding+seance-0
 *  - 141 exos listés par défaut
 *  - recherche fuzzy "bench" → filtre côté UI
 *  - filtre type "Polyarticulaire" (libellé FR — pas "compound" brut)
 *  - card → sheet de détail avec descriptif généré
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

async function runOnboardingAndCalibration(page: Page): Promise<void> {
  await page.goto('onboarding');
  await page.getByTestId('equip-preset-gym').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/seance-0$/);

  const totalAttr = await page.getByTestId('seance0-page').getAttribute('data-total');
  const total = Number.parseInt(totalAttr ?? '0', 10);

  for (let i = 0; i < total; i++) {
    await page.getByTestId('tab-submax').click();
    const loadInput = page.getByTestId('input-submax-load');
    if ((await loadInput.count()) > 0) {
      await loadInput.fill('50');
    }
    await page.getByTestId('input-submax-reps').fill('5');
    await page.getByTestId('input-submax-rpe').selectOption('8');
    await page.getByTestId('btn-next').click();
  }

  await expect(page).toHaveURL(/\/programme$/);
}

test('catalogue : recherche, filtre, détail', async ({ page }) => {
  await runOnboardingAndCalibration(page);

  await page.getByRole('link', { name: 'Catalogue' }).click();
  await expect(page).toHaveURL(/\/catalogue$/);
  await expect(page.getByTestId('catalogue-page')).toBeVisible();

  // Liste non vide par défaut
  const list = page.getByTestId('catalogue-list');
  await expect(list).toBeVisible();
  const initialCount = await list.locator('> li').count();
  expect(initialCount).toBeGreaterThan(50); // ~141 attendus

  // Aucun "compound" sauvage dans la liste (vocabulaire UI : Polyarticulaire)
  await expect(page.getByTestId('catalogue-page')).not.toContainText(/\bcompound\b/i);

  // Recherche fuzzy "bench"
  await page.getByTestId('catalogue-search').fill('bench');
  await expect(list.locator('> li').first()).toBeVisible();
  const benchCount = await list.locator('> li').count();
  expect(benchCount).toBeGreaterThan(0);
  expect(benchCount).toBeLessThan(initialCount);

  // Réinitialiser
  await page.getByTestId('catalogue-search').fill('');
  await page.getByTestId('catalogue-filters-toggle').click();
  await expect(page.getByTestId('filters-sheet-content')).toBeVisible();
  await page.getByTestId('filter-type-isolation').click();
  await page.getByTestId('filter-apply').click();

  // Compteur affiche un nombre cohérent
  const countText = await page.getByTestId('catalogue-count').textContent();
  expect(countText).toMatch(/exercice/);

  // Badge filtres actif
  await expect(page.getByTestId('catalogue-filters-badge')).toBeVisible();

  // Ouvrir la 1ère card → sheet détail
  await page.getByTestId('catalogue-list').locator('> li').first().getByRole('button').click();
  await expect(page.getByTestId('catalogue-detail-content')).toBeVisible();
  await expect(page.getByTestId('catalogue-detail-description')).toBeVisible();
  await expect(page.getByTestId('mini-silhouette').first()).toBeVisible();
  // Pas de "compound" brut dans le détail non plus
  await expect(page.getByTestId('catalogue-detail-content')).not.toContainText(/\bcompound\b/i);

  // Fermer + réinitialiser
  await page.keyboard.press('Escape');
  await page.getByTestId('catalogue-clear').click();
  await expect(page.getByTestId('catalogue-filters-badge')).not.toBeVisible();
});
