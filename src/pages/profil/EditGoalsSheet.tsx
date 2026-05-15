/**
 * Sheet d'édition des objectifs musculaires (Conv #6c).
 *
 * Reprend la mécanique de l'étape 2 onboarding (drag&drop pour le ranking,
 * objectif par muscle, ajout via chips). À la sauvegarde, on appelle
 * `useEngine.updateMuscleGoals` qui ré-applique R1-R4 par-dessus.
 *
 * Note UX : les SUGGERE et NON_COUVERT actuels sont reconduits implicitement
 * via `explicitNonCoveredFromState` côté ProfilPage — pas exposés ici pour
 * garder la sheet simple. Les SUGGERE seront recomposés automatiquement.
 */

import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { MUSCLES, MuscleObjective, type Muscle } from '@/engine/models';
import { cn } from '@/lib/cn';
import { muscleLabel, objectiveLabel } from '@/lib/balance-reasons';
import type { GoalsDraft, RankedGoal } from '@/lib/profile-edit';

interface EditGoalsSheetProps {
  readonly open: boolean;
  readonly initial: GoalsDraft;
  readonly onClose: () => void;
  readonly onSave: (draft: GoalsDraft) => Promise<void> | void;
}

const OBJECTIVES: readonly MuscleObjective[] = [
  MuscleObjective.FORCE,
  MuscleObjective.HYPERTROPHIE,
  MuscleObjective.ENDURANCE,
  MuscleObjective.MAINTIEN,
];

export function EditGoalsSheet({
  open,
  initial,
  onClose,
  onSave,
}: EditGoalsSheetProps) {
  const [priorities, setPriorities] = useState<readonly RankedGoal[]>(
    initial.priorities,
  );
  const [error, setError] = useState<string | null>(null);

  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setPriorities(initial.priorities);
      setError(null);
    }
  }

  const selectedSet = useMemo(
    () => new Set(priorities.map((p) => p.muscle)),
    [priorities],
  );
  const available = useMemo(
    () => MUSCLES.filter((m) => !selectedSet.has(m)),
    [selectedSet],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addMuscle(m: Muscle) {
    setPriorities((arr) => [
      ...arr,
      { muscle: m, objective: MuscleObjective.HYPERTROPHIE },
    ]);
  }

  function removeMuscle(m: string) {
    setPriorities((arr) => arr.filter((p) => p.muscle !== m));
  }

  function setObjective(m: string, obj: MuscleObjective) {
    setPriorities((arr) =>
      arr.map((p) => (p.muscle === m ? { muscle: p.muscle, objective: obj } : p)),
    );
  }

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (over === null || active.id === over.id) return;
    const oldIdx = priorities.findIndex((p) => p.muscle === active.id);
    const newIdx = priorities.findIndex((p) => p.muscle === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setPriorities(arrayMove([...priorities], oldIdx, newIdx));
  }

  async function save() {
    if (priorities.length === 0) {
      setError('Tu dois garder au moins un muscle prioritaire.');
      return;
    }
    try {
      await onSave({
        priorities,
        acceptedSuggestions: initial.acceptedSuggestions,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Modifier mes objectifs">
      <div className="max-h-[75dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-anthracite-500">
            Réorganise tes muscles prioritaires (glisser-déposer) et change leur
            objectif. Les muscles d'équilibre sont recomposés automatiquement.
          </p>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                Mes priorités
              </span>
              <span className="text-xs text-anthracite-500">
                {priorities.length} sélectionné{priorities.length > 1 ? 's' : ''}
              </span>
            </div>

            {priorities.length === 0 ? (
              <div
                data-testid="profil-goals-empty"
                className="rounded-lg border border-dashed border-anthracite-700 px-3 py-6 text-center text-sm text-anthracite-500"
              >
                Aucun muscle prioritaire. Ajoute-en ci-dessous.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={priorities.map((p) => p.muscle)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul
                    className="flex flex-col gap-2"
                    data-testid="profil-goals-list"
                  >
                    {priorities.map((p, i) => (
                      <SortableGoalRow
                        key={p.muscle}
                        rank={i + 1}
                        priority={p}
                        onSetObjective={(obj) => setObjective(p.muscle, obj)}
                        onRemove={() => removeMuscle(p.muscle)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Card>

          {available.length > 0 && (
            <Card>
              <div className="mb-3 text-sm font-medium text-white">
                Ajouter un muscle
              </div>
              <div className="flex flex-wrap gap-2">
                {available.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => addMuscle(m)}
                    data-testid={`profil-goal-add-${m}`}
                    className={cn(
                      'rounded-full border border-anthracite-700 bg-anthracite-900 px-3 py-1.5',
                      'text-xs font-medium text-anthracite-500 transition hover:text-white',
                    )}
                  >
                    + {muscleLabel(m)}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {error !== null && (
            <div
              role="alert"
              data-testid="profil-goals-error"
              className="rounded-lg border border-sang-700 bg-sang-900/30 px-3 py-2 text-sm text-sang-300"
            >
              {error}
            </div>
          )}

          <div className="sticky bottom-0 -mx-1 flex gap-2 bg-anthracite-900 pt-3">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={save}
              data-testid="profil-goals-save"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

interface SortableGoalRowProps {
  readonly rank: number;
  readonly priority: RankedGoal;
  readonly onSetObjective: (obj: MuscleObjective) => void;
  readonly onRemove: () => void;
}

function SortableGoalRow({
  rank,
  priority,
  onSetObjective,
  onRemove,
}: SortableGoalRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: priority.muscle });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`profil-goal-row-${priority.muscle}`}
      className="rounded-xl border border-anthracite-700 bg-anthracite-900 p-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Déplacer"
          data-testid={`profil-goal-drag-${priority.muscle}`}
          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg text-anthracite-500 hover:text-white active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-sang-500">
          {rank}
        </span>
        <span className="flex-1 text-sm text-white">
          {muscleLabel(priority.muscle)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Retirer"
          data-testid={`profil-goal-remove-${priority.muscle}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-anthracite-500 hover:text-sang-500"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex gap-1.5 pl-11">
        {OBJECTIVES.map((obj) => (
          <button
            key={obj}
            type="button"
            onClick={() => onSetObjective(obj)}
            data-testid={`profil-goal-obj-${priority.muscle}-${obj}`}
            className={cn(
              'flex-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition',
              priority.objective === obj
                ? 'border-sang-600 bg-sang-900/30 text-white'
                : 'border-anthracite-700 bg-anthracite-800 text-anthracite-500 hover:text-white',
            )}
          >
            {objectiveLabel(obj)}
          </button>
        ))}
      </div>
    </li>
  );
}
