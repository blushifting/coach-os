import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import type { Catalog } from '@/engine/catalog';
import type { SessionPlan } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import {
  countDoneSets,
  countPlannedSets,
  formatRest,
  type SessionEntries,
  updateSetEntry,
} from '@/lib/session-runner';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { PatternIcon } from './PatternIcon';
import { SetInput } from './SetInput';

interface SessionRunnerProps {
  readonly plan: SessionPlan;
  readonly catalog: Catalog | null;
  readonly entries: SessionEntries;
  readonly onEntriesChange: (next: SessionEntries) => void;
  readonly onFinish: () => void;
  readonly finishing: boolean;
}

/**
 * Écran "État B" — séance en cours. Affiche les exos planifiés, saisie set
 * par set, indicateur de progression. Bouton "Terminer la séance".
 */
export function SessionRunner({
  plan,
  catalog,
  entries,
  onEntriesChange,
  onFinish,
  finishing,
}: SessionRunnerProps) {
  const engine = useEngine();
  const [detail, setDetail] = useState<{ exerciseId: string; itemIndex: number } | null>(null);
  const done = countDoneSets(entries);
  const total = countPlannedSets(entries);

  return (
    <div className="flex flex-col gap-3" data-testid="session-runner">
      <Card accent data-testid="session-progress" className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-sang-400/90">
            Séance
          </span>
          <span className="font-display text-2xl leading-none tracking-wide text-white">
            {plan.label}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-anthracite-300">
            Cycle {plan.cycle_index} · S{plan.week_in_cycle} · Effort cible{' '}
            <span className="tabular-nums text-anthracite-100">{plan.rpe_target}/10</span>
            <HelpButton topic="rpe" label="Aide : effort cible" />
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-anthracite-300">
            Séries
          </span>
          <span className="font-display text-3xl leading-none tabular-nums text-white">
            <span className="text-sang-400">{done}</span>
            <span className="text-anthracite-400"> / {total}</span>
          </span>
        </div>
      </Card>

      <ul className="flex flex-col gap-3">
        {plan.items.map((item, i) => {
          const ex = safeGet(catalog, item.exercise_id);
          const entrySets = entries[i] ?? [];
          const doneCount = entrySets.filter((s) => s.done).length;
          return (
            <li key={`${item.exercise_id}-${i}`}>
              <Card
                className="flex flex-col gap-2"
                data-testid={`exo-card-${i}`}
                data-exercise-id={item.exercise_id}
              >
                <header className="flex items-center gap-2">
                  {ex !== null && <PatternIcon pattern={ex.pattern} size="sm" />}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-white">
                      {ex?.nom_fr ?? item.exercise_id}
                    </span>
                    <span className="text-xs text-anthracite-300">
                      <span
                        className={cn(
                          'font-display tabular-nums tracking-wide',
                          doneCount > 0 ? 'text-sang-400' : 'text-anthracite-200',
                        )}
                      >
                        {doneCount}/{entrySets.length}
                      </span>{' '}
                      séries — repos {formatRest(item.sets[0]?.rest_s ?? 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Détail ${ex?.nom_fr ?? item.exercise_id}`}
                    data-testid={`btn-detail-${i}`}
                    onClick={() => setDetail({ exerciseId: item.exercise_id, itemIndex: i })}
                    className="h-7 w-7 rounded-full bg-anthracite-700 text-xs text-anthracite-300 hover:text-white"
                  >
                    i
                  </button>
                </header>

                <div className="flex flex-col gap-1.5">
                  {entrySets.map((entry, j) => (
                    <SetInput
                      key={j}
                      index={j}
                      entry={entry}
                      checkLocked={j > 0 && !entrySets[j - 1]!.done}
                      onChange={(patch) =>
                        onEntriesChange(updateSetEntry(entries, i, j, patch))
                      }
                    />
                  ))}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onFinish}
        disabled={finishing || done === 0}
        data-testid="btn-finish-session"
      >
        {finishing ? 'Enregistrement…' : 'Terminer la séance'}
      </Button>

      <ExerciseDetailSheet
        open={detail !== null}
        exerciseId={detail?.exerciseId ?? null}
        catalog={catalog}
        onClose={() => setDetail(null)}
        onReplace={
          detail === null
            ? undefined
            : async (newExId) => {
                await engine.replaceSessionExercise({
                  itemIndex: detail.itemIndex,
                  newExerciseId: newExId,
                });
              }
        }
      />
    </div>
  );
}

function safeGet(catalog: Catalog | null, exerciseId: string) {
  if (catalog === null) return null;
  try {
    return catalog.get(exerciseId);
  } catch {
    return null;
  }
}
