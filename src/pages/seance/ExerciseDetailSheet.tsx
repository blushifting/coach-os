import { Sheet } from '@/components/Sheet';
import type { Catalog } from '@/engine/catalog';
import { PatternIcon } from './PatternIcon';

interface ExerciseDetailSheetProps {
  readonly open: boolean;
  readonly exerciseId: string | null;
  readonly catalog: Catalog | null;
  readonly onClose: () => void;
}

/**
 * Sheet de détail d'un exo : pattern, muscles principaux, note technique.
 * Silhouette anatomique = Conv #8. Alternatives = reportées (cf. PlanDaySheet
 * "Changer de variante" Conv #6b/#8).
 */
export function ExerciseDetailSheet({
  open,
  exerciseId,
  catalog,
  onClose,
}: ExerciseDetailSheetProps) {
  if (exerciseId === null || catalog === null) return null;
  let exercise;
  try {
    exercise = catalog.get(exerciseId);
  } catch {
    return null;
  }
  const muscles = Object.entries(exercise.muscles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Sheet open={open} onClose={onClose} title={exercise.nom_fr}>
      <div className="flex flex-col gap-3" data-testid="exercise-detail-content">
        <div className="flex items-center gap-3">
          <PatternIcon pattern={exercise.pattern} />
          <span className="text-xs uppercase tracking-wide text-anthracite-500">
            {exercise.type} · {exercise.charge}
          </span>
        </div>

        {muscles.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-anthracite-500">
              Muscles
            </span>
            <div className="flex flex-wrap gap-1">
              {muscles.map(([m, coef]) => (
                <span
                  key={m}
                  className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white"
                >
                  {m}
                  <span className="ml-1 text-[10px] text-anthracite-500">
                    {(coef * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {exercise.note !== '' && (
          <p className="rounded-lg bg-anthracite-900 p-3 text-sm text-anthracite-500">
            {exercise.note}
          </p>
        )}
      </div>
    </Sheet>
  );
}
