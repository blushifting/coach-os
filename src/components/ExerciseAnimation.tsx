/**
 * Animation d'un exercice : le mannequin en 3D qui fait le mouvement, muscles
 * travaillés colorés d'après le catalogue. Glisser le doigt de gauche à droite
 * fait tourner la caméra autour de lui. Pas de cadre ni de fond : la figure
 * flotte sur la fiche.
 *
 * Si WebGL n'est pas disponible, prévient le parent (`onIndisponible`), qui se
 * replie sur la silhouette et les photos.
 */

import { useEffect, useRef } from 'react';
import { animer } from '@/visuels/animation';
import type { PoseExercice } from '@/visuels/scene';

interface ExerciseAnimationProps {
  readonly pose: PoseExercice;
  /** Muscles travaillés, tels que le catalogue les donne (muscle → 1 ou 0,5). */
  readonly muscles: Readonly<Record<string, number>>;
  readonly onIndisponible: () => void;
}

export function ExerciseAnimation({ pose, muscles, onIndisponible }: ExerciseAnimationProps) {
  const toile = useRef<HTMLCanvasElement>(null);
  const prevenir = useRef(onIndisponible);
  prevenir.current = onIndisponible;

  useEffect(() => {
    if (toile.current === null) return;
    const animation = animer(toile.current, pose, muscles);
    if (animation === null) {
      prevenir.current();
      return;
    }
    return () => animation.arreter();
  }, [pose, muscles]);

  return (
    <canvas
      ref={toile}
      role="img"
      aria-label="Animation du mouvement, à faire tourner en glissant le doigt"
      data-testid={`exercise-animation-${pose.id}`}
      className="block aspect-square w-full touch-pan-y"
    />
  );
}
