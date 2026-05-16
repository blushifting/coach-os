import { Sheet } from '@/components/Sheet';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import {
  buildDescription,
  chargeLabel,
  extypeLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { muscleLabel } from '@/lib/progress';
import { PatternIcon } from '@/pages/seance/PatternIcon';
import { MiniSilhouette } from './MiniSilhouette';

interface CatalogueDetailSheetProps {
  readonly open: boolean;
  readonly exercise: Exercise | null;
  readonly onClose: () => void;
}

/**
 * Sheet de détail Catalogue — descriptif, muscles primaires/synergistes,
 * type/charge/pattern en FR, tags reconnus. Cf. plan Conv #6b.
 */
export function CatalogueDetailSheet({
  open,
  exercise,
  onClose,
}: CatalogueDetailSheetProps) {
  if (exercise === null) return null;

  const primaires = exercisePrimaires(exercise);
  const synergistes = exerciseSynergistes(exercise);
  const tags = exercise.tags
    .map((t) => [t, tagLabel(t)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);

  return (
    <Sheet open={open} onClose={onClose} title={exercise.nom_fr}>
      <div className="flex flex-col gap-4" data-testid="catalogue-detail-content">
        <div className="flex items-start gap-3">
          <MiniSilhouette exercise={exercise} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <PatternIcon pattern={exercise.pattern} size="sm" />
              <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
                {extypeLabel(exercise.type)}
              </span>
              <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
                {chargeLabel(exercise.charge)}
              </span>
              <span className="text-xs text-anthracite-300">
                {patternLabel(exercise.pattern)}
              </span>
            </div>
            <p
              className="text-sm leading-snug text-anthracite-300"
              data-testid="catalogue-detail-description"
            >
              {buildDescription(exercise)}
            </p>
          </div>
        </div>

        {primaires.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-anthracite-300">
              Muscles principaux
            </span>
            <div className="flex flex-wrap gap-1" data-testid="catalogue-muscles-primaires">
              {primaires.map((m) => (
                <span
                  key={m}
                  className="rounded bg-sang-900/40 px-2 py-0.5 text-xs text-white"
                >
                  {muscleLabel(m)}
                </span>
              ))}
            </div>
          </div>
        )}

        {synergistes.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-anthracite-300">
              Synergistes
            </span>
            <div className="flex flex-wrap gap-1" data-testid="catalogue-muscles-synergistes">
              {synergistes.map((m) => (
                <span
                  key={m}
                  className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white"
                >
                  {muscleLabel(m)}
                </span>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-anthracite-300">
              Variantes
            </span>
            <div className="flex flex-wrap gap-1" data-testid="catalogue-tags">
              {tags.map(([key, label]) => (
                <span
                  key={key}
                  className="rounded border border-anthracite-700 px-2 py-0.5 text-xs text-anthracite-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
