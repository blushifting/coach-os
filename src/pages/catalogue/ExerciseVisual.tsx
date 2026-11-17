/**
 * Visuel d'un exercice dans sa fiche : l'animation si l'exercice a une pose
 * validée, sinon ses photos. Un exercice sans pose (ou créé par l'utilisateur),
 * ou un téléphone sans WebGL, garde donc exactement l'affichage d'avant.
 *
 * Jusqu'à l'intégration à la fiche (étape V-6 : signe de rotation, silhouette
 * remplacée, maquette), les animations ne s'affichent que sur le serveur de
 * développement : la production garde ses photos, même pour une pose validée.
 */

import { useState } from 'react';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import type { Exercise } from '@/engine/models';
import { poseValidee } from '@/visuels/poses';
import { ExercisePhoto } from './ExercisePhoto';

/** À passer à `true` à l'étape V-6, quand la fiche aura été conçue pour l'animation. */
const ANIMATIONS_EN_PRODUCTION = false;

interface ExerciseVisualProps {
  readonly exercise: Exercise;
}

export function ExerciseVisual({ exercise }: ExerciseVisualProps) {
  const pose = ANIMATIONS_EN_PRODUCTION || import.meta.env.DEV ? poseValidee(exercise.id) : null;
  const [indisponible, setIndisponible] = useState(false);
  if (pose === null || indisponible) return <ExercisePhoto exerciseId={exercise.id} />;
  return <ExerciseAnimation pose={pose} muscles={exercise.muscles} onIndisponible={() => setIndisponible(true)} />;
}
