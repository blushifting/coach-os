/**
 * Haut de la fiche d'un exercice (catalogue et séance) : à quoi ressemble le
 * mouvement et ce qu'il fait travailler.
 *
 * - Pose validée : le mannequin, sans cadre, qui fait le mouvement ; ses
 *   muscles colorés montrent ce qui travaille. Dessous, « Principaux » et
 *   « Secondaires », côte à côte, lui servent de légende (pastille de la
 *   couleur du mannequin) et nomment ce qui est caché de l'autre côté.
 * - Exercice créé par l'utilisateur (pas de mouvement) : la silhouette 2D,
 *   face et dos, à la même place. Un mannequin qu'on fait tourner laisserait
 *   croire qu'il manque le mouvement ; la silhouette dit d'un coup d'œil que
 *   c'est un exercice à soi. Sans WebGL, même repli (plus les photos).
 */

import { useState, type ReactNode } from 'react';
import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import { muscleLabel } from '@/lib/progress';
import { poseValidee } from '@/visuels/poses';
import { cssCouleur, STYLE } from '@/visuels/style';
import { ExercisePhoto } from './ExercisePhoto';

interface ExerciseVisualProps {
  readonly exercise: Exercise;
  /** Préfixe des `data-testid` : `catalogue` ou `exercise-detail`. */
  readonly testIdPrefix: string;
}

export function ExerciseVisual({ exercise, testIdPrefix }: ExerciseVisualProps) {
  const pose = poseValidee(exercise.id);
  const [indisponible, setIndisponible] = useState(false);
  const anime = pose !== null && !indisponible;

  const highlights: Record<string, SilhouetteStatus> = {};
  if (!anime) {
    for (const [m, coef] of Object.entries(exercise.muscles)) {
      if (coef >= 1.0) highlights[m] = 'highlight';
      else if (coef >= 0.5) highlights[m] = 'synergist';
    }
  }
  const primaires = exercisePrimaires(exercise);
  const synergistes = exerciseSynergistes(exercise);

  return (
    <>
      {pose !== null && anime ? (
        <ExerciseAnimation
          pose={pose}
          muscles={exercise.muscles}
          onIndisponible={() => setIndisponible(true)}
        />
      ) : (
        <>
          <div className="flex justify-center">
            <AnatomicalSilhouette
              highlights={highlights}
              view="both"
              className="h-56 w-auto"
              testId={`${testIdPrefix}-silhouette`}
            />
          </div>
          <ExercisePhoto exerciseId={exercise.id} />
        </>
      )}

      {(primaires.length > 0 || synergistes.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {primaires.length > 0 && (
            <Muscles
              label="Principaux"
              pastille={anime ? cssCouleur(STYLE.principal) : null}
              muscles={primaires}
              chipClassName="bg-sang-900/40"
              testId={`${testIdPrefix}-muscles-primaires`}
            />
          )}
          {synergistes.length > 0 && (
            <Muscles
              label="Secondaires"
              pastille={anime ? cssCouleur(STYLE.secondaire) : null}
              muscles={synergistes}
              chipClassName="bg-anthracite-700"
              testId={`${testIdPrefix}-muscles-synergistes`}
            />
          )}
        </div>
      )}
    </>
  );
}

function Muscles({
  label,
  pastille,
  muscles,
  chipClassName,
  testId,
}: {
  readonly label: string;
  /** Couleur du mannequin pour ce rôle, ou `null` sans mannequin. */
  readonly pastille: string | null;
  readonly muscles: readonly string[];
  readonly chipClassName: string;
  readonly testId: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-anthracite-300">
        {pastille !== null && (
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pastille }} />
        )}
        {label}
      </span>
      <div className="flex flex-wrap gap-1" data-testid={testId}>
        {muscles.map((m) => (
          <span key={m} className={`rounded px-2 py-0.5 text-xs text-white ${chipClassName}`}>
            {muscleLabel(m)}
          </span>
        ))}
      </div>
    </div>
  );
}
