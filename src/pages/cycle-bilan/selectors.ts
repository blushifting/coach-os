/**
 * Sélecteurs purs pour l'écran Bilan de cycle (Conv #5a).
 *
 * Le moteur expose `lastCycleReview` après `useEngine.endOfCycle()`. Si l'user
 * arrive sur la page après un reload (donc `lastCycleReview` est null), on
 * retombe sur le dernier `CycleRow.review` non-null en DB.
 */

import type { Catalog } from '@/engine/catalog';
import { generateCycleReview } from '@/engine/lifecycle';
import type { CycleReview, UserState } from '@/engine/models';
import type { CycleRow, FeedbackRow } from '@/db/schema';
import { isCycleFinished } from '@/lib/dashboard';

export function pickReviewToDisplay(
  lastCycleReview: CycleReview | null,
  cycles: ReadonlyArray<CycleRow>,
): CycleReview | null {
  if (lastCycleReview !== null) return lastCycleReview;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]!;
    if (c.review !== null) return c.review;
  }
  return null;
}

/**
 * Conv #76 — bilan du cycle **en cours**, calculé à la volée.
 *
 * Un `CycleReview` n'existait en mémoire (`lastCycleReview`) ou en base
 * (`CycleRow.review`) qu'**après** `endOfCycle()`, c'est-à-dire après que
 * l'utilisateur ait choisi la suite. Or c'est le bilan qui porte ce choix :
 * l'accueil affichait « Cycle terminé », le lien ouvrait la page, et la page
 * répondait « Aucun bilan disponible » — sans autre issue, puisque le
 * calendrier s'arrête à la fin de la semaine 5.
 *
 * On calcule donc la review du cycle courant dès qu'il est terminé.
 * `generateCycleReview` est une fonction **pure** (aucune mutation de `state`,
 * contrairement à `engine.endOfCycle` qui enchaîne sur
 * `adjustVolumeBoundsAtCycleEnd`) : l'afficher avant validation ne change rien
 * à l'état. Elle sera recalculée à l'identique — mêmes entrées — au moment où
 * l'utilisateur valide, et c'est cette exécution-là qui persiste.
 *
 * Retourne `null` si le cycle n'est pas terminé, ou s'il a déjà sa review
 * archivée (cas d'un cycle clos : la version persistée fait foi).
 */
export function pickPendingCycleReview(args: {
  userState: UserState | null;
  catalog: Catalog | null;
  cycles: ReadonlyArray<CycleRow>;
  feedbacks: ReadonlyArray<Pick<FeedbackRow, 'cycle_index' | 'feedback'>>;
  today: Date;
}): CycleReview | null {
  const { userState, catalog, cycles, feedbacks, today } = args;
  if (userState === null || catalog === null) return null;
  const stored = cycles.find((c) => c.cycle_index === userState.cycle_index);
  if (stored?.review != null) return null;
  if (!isCycleFinished(userState, feedbacks, cycles, today)) return null;
  return generateCycleReview(userState, catalog);
}

/**
 * `action` est typé `string` (pas `SuggestedAction`) : les bilans de cycle
 * archivés avant Chantier C (plan 11) peuvent contenir `'tourner'` ou
 * `'changer'`, des valeurs retirées de l'enum mais encore présentes en DB.
 */
export function suggestedActionLabel(action: string): string {
  switch (action) {
    case 'continuer':
      return 'Continuer pareil';
    case 'ajuster':
      return 'Ajuster les objectifs';
    case 'tourner':
    case 'changer':
      // Actions retirées du produit — les bilans archivés se présentent comme
      // « Ajuster les objectifs » (pas de différence nette côté utilisateur).
      return 'Ajuster les objectifs';
    default:
      return 'Continuer pareil';
  }
}
