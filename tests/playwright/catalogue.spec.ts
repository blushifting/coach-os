import { expect, test } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Catalogue — Conv #6b, refondu Bloc F (Conv #31).
 *
 * Bloc F : la liste plate `<ul>/<li>` est devenue des **bandeaux repliables**
 * (`CatalogueBand`) — Favoris en tête (ouvert), puis un bandeau par type
 * d'équipement (replié par défaut). Une carte d'exo n'est dans le DOM que si
 * son bandeau est ouvert (favoris, type déplié, ou recherche/filtre actif qui
 * force l'ouverture). Le compteur global (`catalogue-count`) reflète le total
 * filtré indépendamment de l'état des bandeaux.
 *
 * Couvre :
 *  - onboarding minimal → /programme → Catalogue via TabBar
 *  - ~141 exos au total par défaut (via le compteur)
 *  - recherche fuzzy "bench" → bandeaux concernés ouverts automatiquement
 *  - filtre type "Isolation" (libellé FR — pas "compound" brut)
 *  - card → sheet de détail avec descriptif généré
 *  - bandeaux repliables + étoile favori (Bloc F)
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

test('catalogue : recherche, filtre, détail', async ({ page }) => {
  await runOnboardingMinimal(page);

  await page.getByRole('link', { name: 'Exercices' }).click();
  await expect(page).toHaveURL(/\/catalogue$/);
  await expect(page.getByTestId('catalogue-page')).toBeVisible();

  const list = page.getByTestId('catalogue-list');
  await expect(list).toBeVisible();

  // Bloc F — la liste est en bandeaux : on lit le total via le compteur global
  // (et non plus en comptant des `<li>`).
  const totalCount = async () => {
    const t = await page.getByTestId('catalogue-count').textContent();
    const m = t?.match(/\d+/);
    return m ? Number.parseInt(m[0], 10) : 0;
  };
  const cards = page.locator('[data-testid^="exercise-card-"]');

  const initialTotal = await totalCount();
  expect(initialTotal).toBeGreaterThan(50); // ~141 attendus

  // Aucun "compound" sauvage dans la liste (vocabulaire UI : Polyarticulaire)
  await expect(page.getByTestId('catalogue-page')).not.toContainText(/\bcompound\b/i);

  // Recherche fuzzy "bench" → les bandeaux contenant des résultats s'ouvrent
  await page.getByTestId('catalogue-search').fill('bench');
  await expect(cards.first()).toBeVisible();
  const benchTotal = await totalCount();
  expect(benchTotal).toBeGreaterThan(0);
  expect(benchTotal).toBeLessThan(initialTotal);

  // Réinitialiser la recherche + filtre type "Isolation"
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

  // Filtre actif → bandeaux ouverts → ouvrir la 1ère card → sheet détail
  await cards.first().click();
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

test('catalogue : bandeaux repliables + favori (Bloc F)', async ({ page }) => {
  await runOnboardingMinimal(page);

  await page.getByRole('link', { name: 'Exercices' }).click();
  await expect(page.getByTestId('catalogue-page')).toBeVisible();

  // Bandeau « Machine » replié par défaut → on l'ouvre, ses cartes apparaissent.
  // Bloc Q (Conv #46) : les bandeaux sont regroupés par famille (clé `machine`
  // qui fond machine guidée + assisté), plus par `ChargeType` brut.
  const machineToggle = page.getByTestId('catalogue-band-toggle-machine');
  await expect(machineToggle).toBeVisible();
  const machineBody = page.getByTestId('catalogue-band-body-machine');
  await expect(machineBody).toBeHidden();
  await machineToggle.click();
  await expect(machineBody).toBeVisible();

  // Étoile favori : on cible un exo machine NON encore favori (locator stable
  // par id, robuste au tri favori-d'abord qui réordonne le bandeau au clic).
  const notFavStar = machineBody
    .locator('[data-testid^="exercise-fav-"][aria-pressed="false"]')
    .first();
  await expect(notFavStar).toBeVisible();
  const starTestId = await notFavStar.getAttribute('data-testid');
  const exoId = starTestId!.replace('exercise-fav-', '');

  await notFavStar.click(); // ajoute aux favoris
  // L'exo apparaît désormais dans le bandeau Favoris (ouvert par défaut).
  const favBody = page.getByTestId('catalogue-band-body-favoris');
  await expect(favBody).toBeVisible();
  await expect(favBody.getByTestId(`exercise-card-${exoId}`)).toBeVisible();
});
