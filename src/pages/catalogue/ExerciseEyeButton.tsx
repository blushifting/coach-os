import { useState } from 'react';
import type { Exercise, GymBrand } from '@/engine/models';
import { photosFor } from '@/data/exercise-photos';
import { displayExerciseName } from '@/lib/catalog-filter';
import { cn } from '@/lib/cn';
import { ExercisePhotoPopin } from './ExercisePhotoPopin';

/**
 * Bouton « œil » réutilisable — Bloc F (Conv #31).
 *
 * Ouvre l'aperçu animé du mouvement (`ExercisePhotoPopin`). Pensé comme une
 * zone SŒUR à côté d'une carte/ligne cliquable (jamais imbriqué dans un autre
 * bouton). Ne rend rien si l'exo n'a pas de photo (`photosFor === null`).
 *
 * Mutualise le motif déjà présent dans `VariantCellSheet` / `VariantPickerSheet`
 * pour pouvoir l'ajouter partout où on liste des exos à choisir.
 */
interface ExerciseEyeButtonProps {
  readonly exercise: Exercise;
  readonly brand?: GymBrand;
  readonly className?: string;
}

export function ExerciseEyeButton({ exercise, brand, className }: ExerciseEyeButtonProps) {
  const [open, setOpen] = useState(false);
  if (photosFor(exercise.id) === null) return null;
  const name = displayExerciseName(exercise, brand);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Voir le mouvement de ${name}`}
        title="Voir le mouvement"
        data-testid={`exercise-eye-${exercise.id}`}
        className={cn(
          'flex w-11 shrink-0 items-center justify-center rounded-xl border border-anthracite-700 bg-anthracite-900 text-anthracite-300 transition hover:border-sang-700 hover:text-white',
          className,
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {open && (
        <ExercisePhotoPopin
          exerciseId={exercise.id}
          title={name}
          open
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
