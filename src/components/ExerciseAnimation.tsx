/**
 * Animation d'un exercice : le mannequin en 3D qui fait le mouvement, muscles
 * travaillés colorés d'après le catalogue. Glisser le doigt de gauche à droite
 * fait tourner la caméra autour de lui.
 *
 * Un arc fléché en filigrane, au pied de la figure, dit qu'elle se tourne. Il
 * s'efface dès que l'utilisateur l'a fait tourner une fois, et ne revient plus
 * sur ce téléphone. Il n'est pas un bouton : il ne capte pas le doigt.
 *
 * Si WebGL n'est pas disponible, prévient le parent (`onIndisponible`), qui se
 * replie sur la photo.
 */

import { useEffect, useRef, useState } from 'react';
import { animer } from '@/visuels/animation';
import type { PoseExercice } from '@/visuels/scene';
import { cn } from '@/lib/cn';

/** Drapeau local au téléphone (pas une donnée de l'utilisateur : ni export, ni sauvegarde). */
const CLE_ROTATION_DECOUVERTE = 'coach-os.rotation-decouverte';

function rotationDecouverte(): boolean {
  try {
    return localStorage.getItem(CLE_ROTATION_DECOUVERTE) === '1';
  } catch {
    return false;
  }
}

function retenirRotationDecouverte(): void {
  try {
    localStorage.setItem(CLE_ROTATION_DECOUVERTE, '1');
  } catch {
    /* navigation privée : l'arc reviendra, sans gravité */
  }
}

interface ExerciseAnimationProps {
  readonly pose: PoseExercice;
  /** Muscles travaillés, tels que le catalogue les donne (muscle → 1 ou 0,5). */
  readonly muscles: Readonly<Record<string, number>>;
  readonly onIndisponible: () => void;
  /** Cadre de la toile ; par défaut, la carte arrondie de la fiche. */
  readonly className?: string;
}

export function ExerciseAnimation({ pose, muscles, onIndisponible, className }: ExerciseAnimationProps) {
  const toile = useRef<HTMLCanvasElement>(null);
  const prevenir = useRef(onIndisponible);
  prevenir.current = onIndisponible;
  const [arcVisible, setArcVisible] = useState(() => !rotationDecouverte());

  useEffect(() => {
    if (toile.current === null) return;
    const animation = animer(toile.current, pose, muscles, () => {
      retenirRotationDecouverte();
      setArcVisible(false);
    });
    if (animation === null) {
      prevenir.current();
      return;
    }
    return () => animation.arreter();
  }, [pose, muscles]);

  return (
    <div className="relative">
      <canvas
        ref={toile}
        role="img"
        aria-label="Animation du mouvement, à faire tourner en glissant le doigt"
        data-testid={`exercise-animation-${pose.id}`}
        className={cn(
          'block aspect-square w-full touch-pan-y bg-anthracite-900',
          className ?? 'rounded-2xl border border-anthracite-700',
        )}
      />
      <svg
        viewBox="0 0 160 28"
        aria-hidden
        data-testid="exercise-animation-arc"
        className={cn(
          'pointer-events-none absolute bottom-1.5 left-1/2 w-[46%] -translate-x-1/2 text-anthracite-300 transition-opacity duration-700',
          arcVisible ? 'opacity-50' : 'opacity-0',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 6 Q80 34 152 6" />
        <path d="M2 2 L9 6 L5 13" />
        <path d="M158 2 L151 6 L155 13" />
      </svg>
    </div>
  );
}
