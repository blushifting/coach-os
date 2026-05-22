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
import {
  AnatomicalSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
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

  // Conv #15 — surlignage silhouette : le top-3 prioritaire est en `highlight`
  // (rouge plein), les suivants en `ok` (vert atténué) pour différencier
  // poids relatif sans surcharger. Hors pool = neutre.
  const silhouetteHighlights = useMemo(() => {
    const out: Record<string, SilhouetteStatus> = {};
    draft.priorities.forEach((p, i) => {
      out[p.muscle] = i < 3 ? 'highlight' : 'ok';
    });
    return out;
  }, [draft.priorities]);

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
    <div className="flex flex-col gap-3 p-3">
      <header className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Étape 2 · Muscles
        </span>
        <h1 className="flex items-center gap-2 font-display text-2xl leading-tight tracking-wide text-white">
          Muscles cibles
          <HelpButton topic="deltoides" label="Aide : deltoïdes" />
        </h1>
      </header>
      <p className="text-[12px] leading-relaxed text-anthracite-200">
        Choisis tes muscles prioritaires et leur ordre d'importance (glisse
        pour réorganiser).
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

      {/* Conv #15 vague 2 — layout 2 colonnes : priorités à gauche (2/3),
          silhouette à droite (1/3). But : tout voir sans scroller. */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Card className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Tes priorités</span>
            <span className="text-xs text-anthracite-300 tabular-nums">
              {draft.priorities.length}
            </span>
          </div>

          {draft.priorities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-anthracite-700 px-2 py-4 text-center text-[11px] text-anthracite-300">
              Aucun muscle pour l'instant.
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
                <ul className="flex flex-col gap-1.5" data-testid="priorities-list">
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

        <Card
          className="flex w-[120px] flex-col items-center gap-1 p-2"
          data-testid="step2-silhouette"
        >
          <AnatomicalSilhouette
            view="both"
            highlights={silhouetteHighlights}
            className="h-40"
            testId="onboarding-silhouette"
          />
          <p className="text-center text-[9px] leading-tight text-anthracite-300">
            {draft.priorities.length === 0 ? (
              'Aperçu'
            ) : (
              <>
                <span className="text-sang-400">●</span> top 3{' '}
                <span className="text-emerald-400">●</span> autres
              </>
            )}
          </p>
        </Card>
      </div>

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
      className="rounded-lg border border-anthracite-700 bg-anthracite-900 p-1.5"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Déplacer"
          data-testid={`drag-${priority.muscle}`}
          // touch-none indispensable : sans ça, le navigateur traite le touch
          // comme un scroll et le PointerSensor ne reçoit pas l'événement.
          className="flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-anthracite-300 hover:text-white active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <span className="w-4 shrink-0 text-center text-xs font-semibold text-sang-500 tabular-nums">
          {rank}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-white">
          {muscleLabel(priority.muscle)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Retirer"
          data-testid={`remove-${priority.muscle}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-anthracite-300 hover:text-sang-500"
        >
          ✕
        </button>
      </div>
      <div className="mt-1 flex gap-1 pl-8">
        {OBJECTIVES.map((obj) => (
          <button
            key={obj}
            type="button"
            onClick={() => onSetObjective(obj)}
            data-testid={`obj-${priority.muscle}-${obj}`}
            className={cn(
              'flex-1 truncate rounded border px-1 py-0.5 text-[10px] font-medium transition',
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
