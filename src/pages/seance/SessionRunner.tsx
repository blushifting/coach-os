import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import type { Catalog } from '@/engine/catalog';
import type { SessionPlan } from '@/engine/models';
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
  const [detailExId, setDetailExId] = useState<string | null>(null);
  const done = countDoneSets(entries);
  const total = countPlannedSets(entries);

  return (
    <div className="flex flex-col gap-3" data-testid="session-runner">
      <Card data-testid="session-progress" className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Séance — {plan.label}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-white">
            Cycle {plan.cycle_index} · S{plan.week_in_cycle} · Effort cible {plan.rpe_target}/10
            <HelpButton topic="rpe" label="Aide : effort cible" />
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-anthracite-300">Séries</span>
          <span className="tabular-nums text-white">
            {done} / {total}
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
                      {doneCount}/{entrySets.length} séries — repos {formatRest(item.sets[0]?.rest_s ?? 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Détail ${ex?.nom_fr ?? item.exercise_id}`}
                    data-testid={`btn-detail-${i}`}
                    onClick={() => setDetailExId(item.exercise_id)}
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
        open={detailExId !== null}
        exerciseId={detailExId}
        catalog={catalog}
        onClose={() => setDetailExId(null)}
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
