import { exercisePrimaires } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import {
  buildDescription,
  chargeLabel,
  extypeLabel,
} from '@/lib/catalog-filter';
import { muscleLabel } from '@/lib/progress';
import { PatternIcon } from '@/pages/seance/PatternIcon';
import { MiniSilhouette } from './MiniSilhouette';

interface ExerciseCardProps {
  readonly exercise: Exercise;
  readonly onClick: () => void;
}

export function ExerciseCard({ exercise, onClick }: ExerciseCardProps) {
  const primaires = exercisePrimaires(exercise);
  const description = buildDescription(exercise);
  const isLengthened = exercise.tags.includes('lengthened_bias');

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`exercise-card-${exercise.id}`}
      className="flex w-full items-start gap-3 rounded-2xl border border-anthracite-700 bg-anthracite-800 p-3 text-left transition hover:border-anthracite-600 active:bg-anthracite-700"
    >
      <MiniSilhouette exercise={exercise} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-white">
            {exercise.nom_fr}
          </span>
          <PatternIcon pattern={exercise.pattern} size="sm" />
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-anthracite-400">
          {description}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-anthracite-700 px-1.5 py-0.5 text-[10px] text-white">
            {extypeLabel(exercise.type)}
          </span>
          <span className="rounded bg-anthracite-700 px-1.5 py-0.5 text-[10px] text-white">
            {chargeLabel(exercise.charge)}
          </span>
          {isLengthened && (
            <span
              className="rounded bg-sang-900/40 px-1.5 py-0.5 text-[10px] text-white"
              data-testid="card-tag-lengthened"
            >
              Étirement
            </span>
          )}
          {primaires.slice(0, 2).map((m) => (
            <span
              key={m}
              className="rounded border border-anthracite-700 px-1.5 py-0.5 text-[10px] text-anthracite-300"
            >
              {muscleLabel(m)}
            </span>
          ))}
          {primaires.length > 2 && (
            <span className="text-[10px] text-anthracite-300">
              +{primaires.length - 2}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
