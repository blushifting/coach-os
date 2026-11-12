import type { Exercise } from '@/engine/models';
import {
  REP_RANGE_KEYS,
  catalogRepRangeKey,
  progressesByReps,
  repRangeKeyOf,
  repRangeLabel,
} from '@/engine/progression';
import { useEngine } from '@/hooks/useEngine';
import { cn } from '@/lib/cn';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';

/**
 * Dump 2.4, étape 4 — choix de la fourchette de reps d'un exercice, dans sa
 * fiche (pas en séance : Azur, conv #82). Trois choix ; celle du catalogue est
 * marquée « conseillée ». Rien pour un exercice qui progresse en reps seulement
 * (poids du corps) : il n'a pas de cran de charge.
 */
export function RepRangePicker({ exercise }: { readonly exercise: Exercise }) {
  const engine = useEngine();
  const demoActive = useDemoMode();
  const userState = useCoachOsStore((s) => s.userState);
  if (userState === null || progressesByReps(userState, exercise)) return null;

  const current = repRangeKeyOf(userState, exercise);
  const advised = catalogRepRangeKey(exercise);

  return (
    <div className="flex flex-col gap-1.5" data-testid={`rep-range-picker-${exercise.id}`}>
      <span className="text-xs uppercase tracking-wide text-anthracite-300">Reps par série</span>
      <div className="flex gap-2" role="radiogroup" aria-label="Reps par série">
        {REP_RANGE_KEYS.map((key) => {
          const selected = key === current;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={demoActive}
              onClick={() => void engine.setRepRange(exercise.id, key)}
              data-testid={`rep-range-${key}`}
              className={cn(
                'flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sang-500 disabled:opacity-50',
                selected
                  ? 'border-sang-600 bg-sang-900/50 text-white'
                  : 'border-anthracite-700 bg-anthracite-800 text-anthracite-200 hover:border-anthracite-500',
              )}
            >
              <span className="font-display text-base tabular-nums">{repRangeLabel(key)}</span>
              {key === advised && (
                <span className={cn('text-[10px]', selected ? 'text-anthracite-200' : 'text-anthracite-400')}>
                  conseillée
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-justify text-[11px] leading-snug text-anthracite-400">
        En haut de la fourchette, on passe à la charge suivante.
      </p>
    </div>
  );
}
