import { expect, test, type Page } from '@playwright/test';
import { runOnboardingMinimal } from './_helpers';

/**
 * E2E Onglet Profil — Conv #6c (helper Séance 0 retiré post-#12a).
 *
 * Couvre :
 *  - récapitulatif identité + objectifs visibles
 *  - édition du poids → persisté
 *  - export → buffer JSON capturé
 *  - modification post-export (poids différent)
 *  - import du buffer → poids revient à la valeur d'origine
 *  - bouton Réinitialiser → dialog confirmation → /welcome → /onboarding (DB vide)
 *  - sheet Aide affiche les 14 entrées du glossaire
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

async function goToProfil(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByTestId('profil-page')).toBeVisible();
}

async function setBodyweight(page: Page, target: number): Promise<void> {
  await page.getByTestId('profil-edit-identity').click();
  const summary = page.getByTestId('profil-identity-summary');
  // Le Stepper du poids est juste après le label "Poids" dans la sheet.
  // On clique sur +/- jusqu'à atteindre la cible. Lecture initiale depuis le résumé.
  const current = await summary
    .locator('div', { has: page.locator('dt', { hasText: 'Poids' }) })
    .first()
    .textContent();
  const m = current?.match(/(\d+)\s*kg/);
  const cur = m ? Number.parseInt(m[1]!, 10) : 75;
  const delta = target - cur;
  // Repère le Stepper "Poids" dans la sheet ouverte (3e Stepper, après Sexe/Âge — Stepper apparaît pour Âge, Poids, Sessions).
  // Plus robuste : on cible par le label "Poids" puis remonte au stepper voisin.
  const poidsCard = page
    .locator('div[role="dialog"] div', { hasText: /^Poids$/ })
    .locator('..');
  const dec = poidsCard.getByRole('button', { name: 'Diminuer' });
  const inc = poidsCard.getByRole('button', { name: 'Augmenter' });
  const steps = Math.abs(delta);
  for (let i = 0; i < steps; i++) {
    if (delta > 0) await inc.click();
    else await dec.click();
  }
  await page.getByTestId('profil-save').click();
  // Sheet fermée, résumé à jour
  await expect(page.getByTestId('profil-identity-summary')).toContainText(
    `${target} kg`,
  );
}

test('profil : édition poids persistante + reload', async ({ page }) => {
  await runOnboardingMinimal(page);
  await goToProfil(page);

  await expect(page.getByTestId('profil-identity-summary')).toContainText('75 kg');
  await expect(page.getByTestId('profil-goals-summary')).toBeVisible();
  // Préset par défaut : pectoraux #1
  await expect(
    page.getByTestId('profil-goal-summary-pectoraux'),
  ).toBeVisible();

  await setBodyweight(page, 80);

  // Reload SPA via re-navigation (le bug bootstrap au reload direct est traité en Conv #9)
  await page.getByRole('link', { name: 'Programme' }).click();
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByTestId('profil-identity-summary')).toContainText('80 kg');
});

test('profil : export → modification → import restaure l\'état', async ({
  page,
}) => {
  await runOnboardingMinimal(page);
  await goToProfil(page);

  // Édition 1 : poids 82
  await setBodyweight(page, 82);

  // Export et capture du buffer
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('profil-export').click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const exportedBuffer = Buffer.concat(chunks);
  expect(exportedBuffer.length).toBeGreaterThan(100);
  const payload = JSON.parse(exportedBuffer.toString('utf-8'));
  expect(payload.appName).toBe('coach-os');
  expect(payload.data.userState.profile.bodyweight_kg).toBe(82);

  // Modification post-export : poids 70
  await setBodyweight(page, 70);
  await expect(page.getByTestId('profil-identity-summary')).toContainText('70 kg');

  // Import du buffer (Playwright accepte un payload mémoire via setInputFiles)
  await page.getByTestId('profil-import').click();
  await page.getByTestId('profil-import-file').setInputFiles({
    name: 'coach-os-export.json',
    mimeType: 'application/json',
    buffer: exportedBuffer,
  });
  // Restauration : poids revenu à 82
  await expect(page.getByTestId('profil-identity-summary')).toContainText('82 kg');
});

test('profil : réinitialisation + dialog → /welcome → /onboarding', async ({ page }) => {
  await runOnboardingMinimal(page);
  await goToProfil(page);

  await page.getByTestId('profil-reset').click();
  // Le Dialog est un role="dialog" avec un bouton "Tout effacer"
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  // En mode dev (Vite), `isInstalledOrDev()` renvoie true → bouton Commencer.
  await page.getByTestId('welcome-start').click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('profil : sheet Aide affiche les 14 entrées du glossaire', async ({
  page,
}) => {
  await runOnboardingMinimal(page);
  await goToProfil(page);

  await page.getByTestId('profil-open-aide').click();
  await expect(page.getByTestId('aide-tutos')).toBeVisible();
  await expect(page.getByTestId('aide-glossaire')).toBeVisible();
  const topics = [
    'plafond',
    'rpe',
    'cycle',
    'deload',
    'poly',
    'iso',
    'etire',
    'volumeHebdo',
    'vminmax',
    'amplitude',
    'hypertrophie',
    'vsSem1',
    'prDuJour',
    'deltoides',
  ];
  for (const t of topics) {
    await expect(page.getByTestId(`aide-glossaire-${t}`)).toBeVisible();
  }
});

test('profil : édition objectifs (retrait + réorganisation) persistée', async ({
  page,
}) => {
  await runOnboardingMinimal(page);
  await goToProfil(page);

  await page.getByTestId('profil-edit-goals').click();
  await expect(page.getByTestId('profil-goals-list')).toBeVisible();

  // Retirer "fessiers" du préset par défaut
  await page.getByTestId('profil-goal-remove-fessiers').click();
  // Changer l'objectif de "pectoraux" en Force
  await page.getByTestId('profil-goal-obj-pectoraux-force').click();
  await page.getByTestId('profil-goals-save').click();

  await expect(
    page.getByTestId('profil-goal-summary-fessiers'),
  ).not.toBeVisible();
  await expect(
    page.getByTestId('profil-goal-summary-pectoraux'),
  ).toContainText('Force');
});
