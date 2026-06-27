/**
 * Sélecteurs purs pour l'écran Bilan de cycle (Conv #5a).
 *
 * Le moteur expose `lastCycleReview` après `useEngine.endOfCycle()`. Si l'user
 * arrive sur la page après un reload (donc `lastCycleReview` est null), on
 * retombe sur le dernier `CycleRow.review` non-null en DB.
 */

import type { CycleReview, SuggestedAction } from '@/engine/models';
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

export function suggestedActionLabel(action: SuggestedAction): string {
  switch (action) {
    case 'continuer':
      return 'Continuer pareil';
    case 'ajuster':
      return 'Ajuster les objectifs';
    case 'tourner':
      // Bloc B1 — plus de 3ᵉ libellé distinct : « tourner » se présente comme
      // « Ajuster les objectifs » (pas de différence nette côté utilisateur, et
      // seuls « Continuer pareil » / « Ajuster les objectifs » ont un bouton).
      return 'Ajuster les objectifs';
    default:
      return 'Continuer pareil';
  }
}
