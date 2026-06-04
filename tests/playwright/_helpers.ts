import { expect, type Page } from '@playwright/test';

/**
 * Onboarding minimal — 5 étapes unifiées (Conv #22.2).
 *
 * Path : Profil → Muscles → Équilibre → Programme → Récap.
 * Le mode custom auto-fill les exos via la préférence équipement
 * (NO_PREFERENCE par défaut → convention salle).
 *
 * Conv #15-7 : l'auto-lancement de la démo en fin d'onboarding est désactivé
 * en e2e via le flag LS `coach-os.skip-auto-demo` posé par
 * `clearDbInitScript()`. Pour tester l'auto-lancement, utiliser
 * `clearDbInitScriptKeepAutoDemo()` dans le beforeEach du test concerné.
 */
export async function runOnboardingMinimal(page: Page): Promise<void> {
  await page.addInitScript(
    `try { localStorage.setItem('coach-os.skip-auto-demo', '1'); } catch (e) {}`,
  );
  await page.goto('onboarding');
  // Step1 — défauts (sexe homme, âge 30, poids 75 kg).
  await page.getByTestId('btn-next').click();
  // Step2 — préset par défaut.
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  // Step3 — suggestions toutes pré-cochées.
  await page.getByTestId('btn-next').click();
  // Step4 — custom + MEDIUM + NO_PREFERENCE par défaut.
  await page.getByTestId('btn-next').click();
  // Step5 — Récap, on finalise.
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

/**
 * Variante sans skip-auto-demo : exécute l'onboarding et laisse l'auto-launch
 * de la démo Alex se déclencher. À utiliser pour tester ce comportement.
 */
export async function runOnboardingMinimalWithAutoDemo(page: Page): Promise<void> {
  await page.goto('onboarding');
  await page.getByTestId('btn-next').click();
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

/**
 * Init script à passer à `context.addInitScript({ content: ... })` dans un
 * `beforeEach` : vide la DB IndexedDB + localStorage et pose le flag
 * `coach-os.skip-auto-demo` pour empêcher l'auto-lancement de la démo Alex
 * après l'onboarding (Conv #15-7). C'est le comportement attendu par défaut
 * pour la majorité des specs qui n'exercent pas la démo.
 */
export function clearDbInitScript(): string {
  return `
    try { indexedDB.deleteDatabase('coach-os'); } catch (e) {}
    try { indexedDB.deleteDatabase('coach-os-db'); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    try { localStorage.setItem('coach-os.skip-auto-demo', '1'); } catch (e) {}
  `;
}

/**
 * Variante sans le flag skip-auto-demo : à utiliser pour le(s) test(s) qui
 * vérifient le comportement d'auto-lancement de la démo en fin d'onboarding.
 */
export function clearDbInitScriptKeepAutoDemo(): string {
  return `
    try { indexedDB.deleteDatabase('coach-os'); } catch (e) {}
    try { indexedDB.deleteDatabase('coach-os-db'); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
  `;
}
