/**
 * Étape 2 de l'onboarding : muscles prioritaires + ranking (drag&drop) +
 * objectif par muscle.
 *
 * - Pool des 15 muscles canoniques (cf. `MUSCLES` dans `engine/models`).
 * - Ajout par tap → entre dans la liste prioritaire en bas du ranking.
 * - Drag&drop pour réordonner (`priority_rank` = position).
 * - Sélecteur d'objectif (Force/Hypertrophie/Endurance/Maintien) par item.
 * - Bouton "Préset par défaut" (full-body Hypertrophie) — utile en garde-fou.
 */

import { useMemo } from 'react';
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
import { MUSCLES, MuscleObjective, type Muscle } from '@/engine/models';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import { muscleLabel, objectiveLabel } from '@/lib/balance-reasons';
import {
  PRESET_DEFAULT_PRIORITIES,
  type OnboardingDraft,
  type RankedPriority,
} from '@/lib/onboarding-state';

interface Step2Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
}

const OBJECTIVES: readonly MuscleObjective[] = [
  MuscleObjective.FORCE,
  MuscleObjective.HYPERTROPHIE,
  MuscleObjective.ENDURANCE,
  MuscleObjective.MAINTIEN,
];

export function Step2Muscles({ draft, onChange }: Step2Props) {
  const selectedSet = useMemo(
    () => new Set(draft.priorities.map((p) => p.muscle)),
    [draft.priorities],
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
    const next: readonly RankedPriority[] = [
      ...draft.priorities,
      { muscle: m, objective: MuscleObjective.HYPERTROPHIE },
    ];
    onChange({ priorities: next });
  }

  function removeMuscle(m: string) {
    onChange({ priorities: draft.priorities.filter((p) => p.muscle !== m) });
  }

  function setObjective(m: string, obj: MuscleObjective) {
    onChange({
      priorities: draft.priorities.map((p) =>
        p.muscle === m ? { muscle: p.muscle, objective: obj } : p,
      ),
    });
  }

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (over === null || active.id === over.id) return;
    const oldIdx = draft.priorities.findIndex((p) => p.muscle === active.id);
    const newIdx = draft.priorities.findIndex((p) => p.muscle === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange({ priorities: arrayMove([...draft.priorities], oldIdx, newIdx) });
  }

  function applyPreset() {
    onChange({ priorities: [...PRESET_DEFAULT_PRIORITIES] });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Étape 2
        </span>
        <h1 className="flex items-center gap-2 font-display text-3xl leading-tight tracking-wide text-white">
          Muscles cibles
          <HelpButton topic="deltoides" label="Aide : deltoïdes" />
        </h1>
      </header>
      <p className="text-sm leading-relaxed text-anthracite-200">
        Choisis tes muscles prioritaires et leur ordre d'importance. Glisse pour
        réorganiser. Tu pourras toujours modifier plus tard.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={applyPreset}
          data-testid="preset-default"
        >
          Préset par défaut (full-body)
        </Button>
        {draft.priorities.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ priorities: [] })}
            data-testid="priorities-clear"
          >
            Tout retirer
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Tes priorités</span>
          <span className="text-xs text-anthracite-300">
            {draft.priorities.length} sélectionné{draft.priorities.length > 1 ? 's' : ''}
          </span>
        </div>

        {draft.priorities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-anthracite-700 px-3 py-6 text-center text-sm text-anthracite-300">
            Aucun muscle pour l'instant. Ajoute-en ci-dessous ou utilise le préset.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={draft.priorities.map((p) => p.muscle)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2" data-testid="priorities-list">
                {draft.priorities.map((p, i) => (
                  <SortablePriorityRow
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

      <Card>
        <div className="mb-3 text-sm font-medium text-white">Ajouter un muscle</div>
        {available.length === 0 ? (
          <div className="text-xs text-anthracite-300">
            Tous les muscles canoniques sont sélectionnés.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addMuscle(m)}
                data-testid={`add-${m}`}
                className={cn(
                  'rounded-full border border-anthracite-700 bg-anthracite-900 px-3 py-1.5',
                  'text-xs font-medium text-anthracite-300 transition hover:text-white',
                )}
              >
                + {muscleLabel(m)}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface SortablePriorityRowProps {
  readonly rank: number;
  readonly priority: RankedPriority;
  readonly onSetObjective: (obj: MuscleObjective) => void;
  readonly onRemove: () => void;
}

function SortablePriorityRow({
  rank,
  priority,
  onSetObjective,
  onRemove,
}: SortablePriorityRowProps) {
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
      data-testid={`priority-${priority.muscle}`}
      className="rounded-xl border border-anthracite-700 bg-anthracite-900 p-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Déplacer"
          data-testid={`drag-${priority.muscle}`}
          // touch-none indispensable : sans ça, le navigateur traite le touch
          // comme un scroll et le PointerSensor ne reçoit pas l'événement.
          className="flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg text-anthracite-300 hover:text-white active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <span className="w-6 text-center text-sm font-semibold text-sang-500 tabular-nums">
          {rank}
        </span>
        <span className="flex-1 text-sm text-white">{muscleLabel(priority.muscle)}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Retirer"
          data-testid={`remove-${priority.muscle}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-anthracite-300 hover:text-sang-500"
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
            data-testid={`obj-${priority.muscle}-${obj}`}
            className={cn(
              'flex-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition',
              priority.objective === obj
                ? 'border-sang-600 bg-sang-900/30 text-white'
                : 'border-anthracite-700 bg-anthracite-800 text-anthracite-300 hover:text-white',
            )}
          >
            {objectiveLabel(obj)}
          </button>
        ))}
      </div>
    </li>
  );
}
