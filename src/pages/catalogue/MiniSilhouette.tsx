/**
 * Mini-silhouette pour les cards Catalogue — Conv #8b.
 *
 * Wrapper compact autour de `AnatomicalSilhouette` (vue face uniquement),
 * qui illumine :
 *  - muscles primaires (coef ≥ 1.0) en `highlight` (rouge sang plein),
 *  - synergistes (coef 0.5-0.99) en `synergist` (rouge sang sombre atténué).
 *
 * Taille calibrée pour rester dans le cadre des cards (~h-20 = 80 px).
 */

import {
  AnatomicalSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import type { Exercise } from '@/engine/models';

interface MiniSilhouetteProps {
  /** Exercice complet (lecture du dict `muscles` pour primaires + synergistes). */
  readonly exercise?: Exercise;
  /** Compat ancienne signature : liste de muscles primaires uniquement. */
  readonly muscles?: readonly string[];
}

export function MiniSilhouette({ exercise, muscles }: MiniSilhouetteProps) {
  const highlights: Record<string, SilhouetteStatus> = {};

  if (exercise) {
    for (const [m, coef] of Object.entries(exercise.muscles)) {
      if (coef >= 1.0) {
        highlights[m] = 'highlight';
      } else if (coef >= 0.5) {
        highlights[m] = 'synergist';
      }
    }
  } else if (muscles) {
    for (const m of muscles) {
      highlights[m] = 'highlight';
    }
  }

  return (
    <AnatomicalSilhouette
      highlights={highlights}
      view="auto"
      className="h-20 w-auto shrink-0"
      testId="mini-silhouette"
    />
  );
}
