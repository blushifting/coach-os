/**
 * Sélecteurs purs pour l'écran Bilan de cycle (Conv #5a).
 *
 * Le moteur expose `lastCycleReview` après `useEngine.endOfCycle()`. Si l'user
 * arrive sur la page après un reload (donc `lastCycleReview` est null), on
 * retombe sur le dernier `CycleRow.review` non-null en DB.
 */

import type { CycleReview } from '@/engine/models';
import type { CycleRow } from '@/db/schema';

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
