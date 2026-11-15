/**
 * Visuel d'un exercice dans sa fiche : l'animation si l'exercice a une pose
 * validée, sinon ses photos. Un exercice sans pose (ou créé par l'utilisateur),
 * ou un téléphone sans WebGL, garde donc exactement l'affichage d'avant.
 */

import { useState } from 'react';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import type { Exercise } from '@/engine/models';
import { poseValidee } from '@/visuels/poses';
import { ExercisePhoto } from './ExercisePhoto';

interface ExerciseVisualProps {
  readonly exercise: Exercise;
}

export function ExerciseVisual({ exercise }: ExerciseVisualProps) {
  const pose = poseValidee(exercise.id);
  const [indisponible, setIndisponible] = useState(false);
  if (pose === null || indisponible) return <ExercisePhoto exerciseId={exercise.id} />;
  return <ExerciseAnimation pose={pose} muscles={exercise.muscles} onIndisponible={() => setIndisponible(true)} />;
}
