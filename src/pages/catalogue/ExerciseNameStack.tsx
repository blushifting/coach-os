/**
 * Affichage hiérarchisé du nom d'un exo (Conv #23 retour Azur).
 *
 * Quand l'user a déclaré la marque de ses machines et qu'un nom
 * commercial existe pour l'exo :
 *  - Ligne principale : nom commercial en `font-display` (Inter Tight)
 *    pour le distinguer du flux Inter normal et faire écho au
 *    libellé étiqueté sur la machine en salle.
 *  - Sous-titre : nom FR générique en plus petit, atténué — pour que
 *    l'user puisse encore reconnaître l'exo par son nom francisé.
 *
 * Sans match de marque : on retombe sur le simple nom_fr, sans
 * sous-titre, en typo Inter normale (pas font-display) — l'écran reste
 * homogène pour les exos non-machine (barre, haltère, poids du corps).
 */

import type { Exercise } from '@/engine/models';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';

interface ExerciseNameStackProps {
  readonly exercise: Exercise;
  /** Taille de typo du titre. Default 'sm'. */
  readonly size?: 'xs' | 'sm' | 'base' | 'lg';
  readonly className?: string;
}

const TITLE_SIZE_CLS: Record<'xs' | 'sm' | 'base' | 'lg', string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const SUBTITLE_SIZE_CLS: Record<'xs' | 'sm' | 'base' | 'lg', string> = {
  xs: 'text-[10px]',
  sm: 'text-[11px]',
  base: 'text-xs',
  lg: 'text-sm',
};

export function ExerciseNameStack({
  exercise,
  size = 'sm',
  className,
}: ExerciseNameStackProps) {
  const brand = useGymBrand();
  const displayed = displayExerciseName(exercise, brand ?? undefined);
  const isBranded = displayed !== exercise.nom_fr;
  return (
    <span
      className={`flex min-w-0 flex-col gap-0 ${className ?? ''}`}
      data-branded={isBranded ? '1' : '0'}
    >
      <span
        className={`truncate font-medium text-white ${TITLE_SIZE_CLS[size]} ${isBranded ? 'font-display tracking-tight' : ''}`}
      >
        {displayed}
      </span>
      {isBranded && (
        <span
          className={`truncate italic text-anthracite-400 ${SUBTITLE_SIZE_CLS[size]}`}
        >
          {exercise.nom_fr}
        </span>
      )}
    </span>
  );
}
