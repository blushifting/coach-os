/**
 * Carte « Ton programme » du Profil : le mode de
 * construction (à la main ou sur mesure) et chaque séance avec ses exercices et
 * leurs séries. « Modifier » ouvre l'éditeur du cycle en cours.
 */

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Catalog } from '@/engine/catalog';
import type { WeeklyTemplate } from '@/engine/models';
import { displayExerciseName } from '@/lib/catalog-filter';
import { sessionDisplayName } from '@/lib/session-label';
import type { GymBrand } from '@/engine/models';

interface ProgrammeCardProps {
  readonly plan: WeeklyTemplate | null;
  readonly buildMode: 'auto' | 'manual';
  readonly sessionsPerWeek: number;
  readonly catalog: Catalog | null;
  readonly brand: GymBrand | undefined;
  readonly onEdit: () => void;
  readonly editDisabled: boolean;
}

export function ProgrammeCard({
  plan,
  buildMode,
  sessionsPerWeek,
  catalog,
  brand,
  onEdit,
  editDisabled,
}: ProgrammeCardProps) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Ton programme</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={editDisabled || plan === null}
          data-testid="profil-edit-programme"
        >
          Modifier
        </Button>
      </div>
      <div className="mb-3 flex items-center gap-2" data-testid="profil-programme-summary">
        <span className="rounded-full border border-anthracite-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-anthracite-300">
          {buildMode === 'manual' ? 'À la main' : 'Sur mesure'}
        </span>
        <span className="text-xs tabular-nums text-anthracite-400">
          {sessionsPerWeek} séance{sessionsPerWeek > 1 ? 's' : ''} par semaine
        </span>
      </div>
      {plan !== null && catalog !== null && (
        <ul className="flex flex-col divide-y divide-anthracite-700">
          {plan.days.map((day, di) => {
            const nSets = day.exercises.reduce((a, e) => a + e.base_sets, 0);
            const exos = day.exercises.filter((e) => catalog.has(e.exercise_id));
            return (
              <li key={di} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-white">
                  <span className="truncate">Séance {sessionDisplayName(day)}</span>
                  <span className="shrink-0 text-xs font-normal tabular-nums text-anthracite-400">
                    {exos.length} exercice{exos.length > 1 ? 's' : ''} · {nSets} séries
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-anthracite-300">
                  {exos.map((e, i) => (
                    <span key={`${e.exercise_id}-${i}`}>
                      {i > 0 && ' · '}
                      {displayExerciseName(catalog.get(e.exercise_id), brand)}{' '}
                      <span className="tabular-nums text-anthracite-400">{e.base_sets}</span>
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
