import { expect, type Page } from '@playwright/test';

/**
 * Onboarding minimal post-#12a (Conv #13 / fix Séance 0).
 *
 * La Séance 0 dédiée a été retirée en Conv #12a — l'onboarding navigue
 * directement vers `/programme`, et les plafonds sont bootstrappés à la
 * 1re séance via heuristique bw-based puis raffinés par feedback RPE.
 *
 * Ce helper remplace l'ancien `runOnboardingAndCalibration` qui était
 * dupliqué dans 5+ specs. Il fait le parcours minimal préset par défaut +
 * équip gym, puis vérifie l'arrivée sur `/programme`.
 *
 * Conv #15-7 : l'auto-lancement de la démo en fin d'onboarding est désactivé
 * en e2e via le flag LS `coach-os.skip-auto-demo` posé par
 * `clearDbInitScript()`. Pour tester l'auto-lancement, utiliser
 * `clearDbInitScriptKeepAutoDemo()` dans le beforeEach du test concerné.
 */
export async function runOnboardingMinimal(page: Page): Promise<void> {
  // Conv #15-7 — empêche l'auto-lancement de la démo Alex en fin d'onboarding
  // (sinon la welcome overlay démo apparaît sur /programme et bloque les
  // assertions des autres tests). Les tests qui exercent l'auto-démo doivent
  // utiliser `runOnboardingMinimalWithAutoDemo()` à la place.
  await page.addInitScript(
    `try { localStorage.setItem('coach-os.skip-auto-demo', '1'); } catch (e) {}`,
  );
  await page.goto('onboarding');
  // Conv #22 — Step1 sans équipement ni niveau, juste sexe/âge/poids.
  await page.getByTestId('btn-next').click(); // Step1 -> Step2 (Muscles)
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click(); // Step2 -> Step3 (Équilibre)
  await page.getByTestId('btn-next').click(); // Step3 -> Step4 (Programme)
  // Step4 : on prend un programme guidé pour court-circuiter les étapes
  // 5/6 du mode custom co-construit (qui demanderait de remplir cases).
  // Onboarding minimal = parcours rapide, l'algo programme guidé/custom
  // est testé en unitaire.
  await page.getByTestId('program-ss').click(); // Starting Strength
  await page.getByTestId('btn-next').click(); // Step4 -> Step5 (Récap guidé)
  await page.getByTestId('btn-finish').click();
  await expect(page).toHaveURL(/\/programme$/);
}

/**
 * Variante sans skip-auto-demo : exécute l'onboarding et laisse l'auto-launch
 * de la démo Alex se déclencher. À utiliser pour tester ce comportement.
 */
export async function runOnboardingMinimalWithAutoDemo(page: Page): Promise<void> {
  await page.goto('onboarding');
  // Conv #22 — Step1 sans équipement ni niveau, juste sexe/âge/poids.
  await page.getByTestId('btn-next').click(); // Step1 -> Step2 (Muscles)
  await page.getByTestId('preset-default').click();
  await page.getByTestId('btn-next').click(); // Step2 -> Step3 (Équilibre)
  await page.getByTestId('btn-next').click(); // Step3 -> Step4 (Programme)
  // Step4 : on prend un programme guidé pour court-circuiter les étapes
  // 5/6 du mode custom co-construit (qui demanderait de remplir cases).
  // Onboarding minimal = parcours rapide, l'algo programme guidé/custom
  // est testé en unitaire.
  await page.getByTestId('program-ss').click(); // Starting Strength
  await page.getByTestId('btn-next').click(); // Step4 -> Step5 (Récap guidé)
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
