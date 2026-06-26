import { expect, type Page } from '@playwright/test';

/**
 * Onboarding minimal — 4 étapes unifiées (Conv #28).
 *
 * Path : Profil → Muscles → Programme → Récap. Le préset full-body couvre
 * tous les muscles → pas de popin d'équilibre sur ce chemin. Le mode custom
 * auto-fill les exos via la préférence équipement (NO_PREFERENCE par défaut
 * → convention salle).
 *
 * Conv #49 : le forçage de la démo en fin d'onboarding a été retiré du code,
 * donc plus aucun flag à poser ici — on atterrit simplement sur /programme.
 */
export async function runOnboardingMinimal(page: Page): Promise<void> {
  await page.goto('onboarding');
  // Step1 — défauts (sexe homme, âge 30, poids 75 kg).
  await page.getByTestId('btn-next').click();
  // Step2 — préset par défaut (couverture intégrale, pas de popin).
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  // Step3 — Programme : custom + MEDIUM + NO_PREFERENCE par défaut.
  await page.getByTestId('btn-next').click();
  // Step4 — Récap, on finalise.
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

/**
 * Init script à passer à `context.addInitScript({ content: ... })` dans un
 * `beforeEach` : vide la DB IndexedDB + localStorage.
 */
export function clearDbInitScript(): string {
  return `
    try { indexedDB.deleteDatabase('coach-os'); } catch (e) {}
    try { indexedDB.deleteDatabase('coach-os-db'); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
  `;
}
