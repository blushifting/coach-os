import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import { kgUnitLabelShort } from '@/lib/catalog-filter';
import { cn } from '@/lib/cn';
import { muscleLabel } from '@/lib/progress';
import { ChargeBadge } from './ChargeBadge';
import { ExerciseNameStack } from './ExerciseNameStack';
import { FavoriteStar } from './FavoriteStar';
import { MiniSilhouette } from './MiniSilhouette';

interface ExerciseCardProps {
  readonly exercise: Exercise;
  readonly onClick: () => void;
  /** Plafond mesuré pour cet exo (kg) — null si jamais mesuré. */
  readonly e1rm?: number | null;
  /** Exo dans les favoris unifiés. */
  readonly isFavorite?: boolean;
  /**
   * Bascule favori. Si absent, l'étoile devient un simple indicateur
   * non cliquable (listes en lecture seule, mode démo).
   */
  readonly onToggleFavorite?: () => void;
}

export function ExerciseCard({
  exercise,
  onClick,
  e1rm = null,
  isFavorite = false,
  onToggleFavorite,
}: ExerciseCardProps) {
  const primaires = exercisePrimaires(exercise);
  const synergistes = exerciseSynergistes(exercise);

  // Carte = deux zones SŒURS non imbriquées (cf.
  // `VariantCellSheet.VariantRow`) : la zone principale ouvre la fiche, la
  // colonne étoile à droite bascule le favori. Pas de <button> dans <button>.
  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-2xl border bg-anthracite-800 transition',
        isFavorite ? 'border-amber-400/30' : 'border-anthracite-700 hover:border-anthracite-600',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        data-testid={`exercise-card-${exercise.id}`}
        className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left transition active:bg-anthracite-700"
      >
      <MiniSilhouette exercise={exercise} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <ExerciseNameStack exercise={exercise} size="sm" className="flex-1" multiligne />
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Plafond mis en évidence : chip distinct à droite
                du nom, fond sang plein + font-display tabulaire pour
                ressortir à côté des étiquettes de muscles. */}
            {e1rm !== null && e1rm > 0 && (
              <span
                data-testid={`card-e1rm-${exercise.id}`}
                className="rounded-md bg-gradient-to-b from-sang-600 to-sang-800 px-2 py-0.5 font-display text-xs leading-none tabular-nums text-white shadow-glow-sang"
                title="Ton Plafond mesuré (1 rep)"
              >
                {e1rm.toFixed(0)} {kgUnitLabelShort(exercise.charge)}
              </span>
            )}
            {/* Picto catégorie en évidence avec couleur de fond
                distincte. Remplace l'ancien PatternIcon (peu évocateur). */}
            <ChargeBadge charge={exercise.charge} size={28} />
          </div>
        </div>
        {/* Les muscles travaillés, comme dans la fiche : principaux en
            surbrillance, secondaires en gris. */}
        <div className="flex flex-wrap items-center gap-1" data-testid={`card-muscles-${exercise.id}`}>
          {primaires.map((m) => (
            <span key={m} className="rounded bg-sang-800 px-1.5 py-0.5 text-[10px] text-white">
              {muscleLabel(m)}
            </span>
          ))}
          {synergistes.map((m) => (
            <span key={m} className="rounded bg-anthracite-700 px-1.5 py-0.5 text-[10px] text-anthracite-200">
              {muscleLabel(m)}
            </span>
          ))}
        </div>
      </div>
      </button>
      {onToggleFavorite ? (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          data-testid={`exercise-fav-${exercise.id}`}
          className={cn(
            'flex w-11 shrink-0 items-center justify-center border-l border-anthracite-700 transition',
            isFavorite
              ? 'text-amber-400 hover:bg-amber-400/10'
              : 'text-anthracite-500 hover:bg-amber-400/5 hover:text-anthracite-300',
          )}
        >
          <FavoriteStar filled={isFavorite} size={20} />
        </button>
      ) : (
        <span
          aria-hidden
          className={cn(
            'flex w-11 shrink-0 items-center justify-center border-l border-anthracite-700',
            isFavorite ? 'text-amber-400' : 'text-anthracite-700',
          )}
        >
          <FavoriteStar filled={isFavorite} size={20} />
        </span>
      )}
    </div>
  );
}
