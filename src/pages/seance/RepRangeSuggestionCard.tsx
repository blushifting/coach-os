import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Catalog } from '@/engine/catalog';
import { repRangeLabel, type RepRangeSuggestion } from '@/engine/progression';
import type { RepRangeKey } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useDemoMode, useGymBrand } from '@/store/selectors';

/** Charge lisible (virgule décimale). */
function fmtLoad(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

/**
 * Dump 2.4, étape 4 — fin de séance : la fourchette de cet exercice est trop
 * étroite pour ses crans (deux séances de suite, une montée a fait tomber sous
 * le bas). On l'explique avec les charges réelles et on propose la fourchette
 * plus large. Jamais sur la fiche : la proposition arrive quand le problème est
 * constaté (Azur, conv #82). Information neutre → bleu.
 */
export function RepRangeSuggestionCard({
  suggestion,
  catalog,
  style,
}: {
  readonly suggestion: RepRangeSuggestion;
  readonly catalog: Catalog | null;
  readonly style?: React.CSSProperties;
}) {
  const engine = useEngine();
  const demoActive = useDemoMode();
  const brand = useGymBrand() ?? undefined;
  const [answer, setAnswer] = useState<RepRangeKey | null>(null);
  const [saving, setSaving] = useState(false);

  const ex = catalog !== null && catalog.has(suggestion.exercise_id) ? catalog.get(suggestion.exercise_id) : null;
  const name = ex !== null ? displayExerciseName(ex, brand) : suggestion.exercise_id;
  const unit = ex !== null ? kgUnitLabel(ex.charge) : 'kg';
  const { trap, from, to } = suggestion;

  const choose = async (key: RepRangeKey): Promise<void> => {
    setSaving(true);
    try {
      await engine.setRepRange(suggestion.exercise_id, key);
      setAnswer(key);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="flex flex-col gap-2 border border-blue-700/40 bg-blue-900/20 motion-safe:animate-reveal-up"
      style={style}
      data-testid={`summary-rep-range-${suggestion.exercise_id}`}
    >
      <h3 className="text-sm font-semibold text-white">
        {name}&nbsp;: une fourchette plus large&nbsp;?
      </h3>
      {answer === null ? (
        <>
          <p className="text-justify text-xs leading-relaxed text-blue-100">
            À {fmtLoad(trap.toLoad)}&nbsp;{unit}, tu tombes à {trap.toReps}&nbsp;reps, sous ta
            fourchette {repRangeLabel(from)}&nbsp;: la charge redescend à {fmtLoad(trap.fromLoad)}&nbsp;{unit}{' '}
            à chaque fois. En {repRangeLabel(to)}, tu gagnes des reps à {fmtLoad(trap.fromLoad)}&nbsp;{unit}{' '}
            avant de monter, et tu restes dans la fourchette.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              disabled={demoActive || saving}
              onClick={() => void choose(to)}
              data-testid="btn-rep-range-accept"
            >
              Passer en {repRangeLabel(to)}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              disabled={demoActive || saving}
              onClick={() => void choose(from)}
              data-testid="btn-rep-range-keep"
            >
              Garder {repRangeLabel(from)}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-justify text-xs leading-relaxed text-blue-100" data-testid="rep-range-answer">
          {answer === to
            ? `Fourchette ${repRangeLabel(to)} enregistrée.`
            : `On garde ${repRangeLabel(from)}. Tu peux la changer dans la fiche de l'exercice.`}
        </p>
      )}
    </Card>
  );
}
