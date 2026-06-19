/**
 * Étape 2 de l'onboarding (refonte Conv #28) : muscles + objectif par muscle.
 *
 * Modèle « pinceau » : un sélecteur d'objectif (Hypertrophie / Force /
 * Endurance / Maintien) au-dessus de la silhouette ; taper un muscle lui
 * applique l'objectif courant, retaper avec le même pinceau le retire.
 *
 * Le ranking drag&drop disparaît de l'UI mais `priority_rank` reste
 * alimenté : rang = ordre de sélection, visible (numéro) et réordonnable
 * (poignée de drag) dans la liste sous la silhouette.
 *
 * La liste des 15 muscles est l'autre vue du même état : prioritaires en
 * tête (ordre de rang), maintiens ensuite, non-sélectionnés en ordre
 * anatomique. Chaque ligne porte un contrôle 5 positions (– / H / F / E / M).
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
import { MUSCLES, MuscleObjective, type Muscle } from '@/engine/models';
import {
  AnatomicalSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/cn';
import { muscleLabel } from '@/lib/balance-reasons';
import {
  PRESET_DEFAULT_MAINTENANCE,
  PRESET_DEFAULT_PRIORITIES,
  type OnboardingDraft,
  type RankedPriority,
} from '@/lib/onboarding-state';

interface Step2Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
  /**
   * Bloc O — appelé quand l'utilisateur applique le préset full-body. Le préset
   * laisse volontairement 4 muscles absents (couverts par proxy) ; OnboardingPage
   * pré-décline alors la popin d'équilibre pour ne pas nager sur ce choix.
   */
  readonly onPresetApplied?: () => void;
}

/** Style par objectif — voir la doc palette `objective` de la silhouette. */
const OBJECTIVE_UI: Record<
  MuscleObjective,
  {
    readonly label: string;
    readonly letter: string;
    readonly dot: string;
    readonly chipActive: string;
    readonly silhouette: SilhouetteStatus;
  }
> = {
  [MuscleObjective.HYPERTROPHIE]: {
    label: 'Hypertrophie',
    letter: 'H',
    dot: 'bg-amber-400',
    chipActive: 'border-amber-400 bg-amber-400/15 text-amber-300',
    silhouette: 'highlight',
  },
  [MuscleObjective.FORCE]: {
    label: 'Force',
    letter: 'F',
    dot: 'bg-sang-500',
    chipActive: 'border-sang-500 bg-sang-900/40 text-sang-400',
    silhouette: 'high',
  },
  [MuscleObjective.ENDURANCE]: {
    label: 'Endurance',
    letter: 'E',
    dot: 'bg-cyan-500',
    chipActive: 'border-cyan-500 bg-cyan-500/15 text-cyan-300',
    silhouette: 'low',
  },
  [MuscleObjective.MAINTIEN]: {
    label: 'Maintien',
    letter: 'M',
    dot: 'bg-amber-700',
    chipActive: 'border-amber-700 bg-amber-700/20 text-amber-600',
    silhouette: 'ok',
  },
};

const BRUSHES: readonly MuscleObjective[] = [
  MuscleObjective.HYPERTROPHIE,
  MuscleObjective.FORCE,
  MuscleObjective.ENDURANCE,
  MuscleObjective.MAINTIEN,
];

/** Objectif courant d'un muscle dans le draft, ou `null` si non sélectionné. */
function muscleObjective(
  draft: OnboardingDraft,
  m: string,
): MuscleObjective | null {
  const prio = draft.priorities.find((p) => p.muscle === m);
  if (prio !== undefined) return prio.objective;
  if (draft.maintenance.has(m)) return MuscleObjective.MAINTIEN;
  return null;
}

export function Step2Muscles({ draft, onChange, onPresetApplied }: Step2Props) {
  const [brush, setBrush] = useState<MuscleObjective>(
    MuscleObjective.HYPERTROPHIE,
  );

  const silhouetteHighlights = useMemo(() => {
    const out: Record<string, SilhouetteStatus> = {};
    for (const p of draft.priorities) {
      out[p.muscle] = OBJECTIVE_UI[p.objective].silhouette;
    }
    for (const m of draft.maintenance) {
      out[m] = OBJECTIVE_UI[MuscleObjective.MAINTIEN].silhouette;
    }
    return out;
  }, [draft.priorities, draft.maintenance]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Applique `obj` au muscle `m` (ou le retire si `obj` est déjà son état,
   * ou si `obj` est null). Un prio qui change d'objectif H/F/E garde son rang.
   */
  function setMuscle(m: string, obj: MuscleObjective | null) {
    const current = muscleObjective(draft, m);
    const target = current === obj ? null : obj;

    const maintenance = new Set(draft.maintenance);
    maintenance.delete(m);
    let priorities: readonly RankedPriority[] = draft.priorities;

    if (target === null) {
      priorities = priorities.filter((p) => p.muscle !== m);
    } else if (target === MuscleObjective.MAINTIEN) {
      priorities = priorities.filter((p) => p.muscle !== m);
      maintenance.add(m);
    } else if (priorities.some((p) => p.muscle === m)) {
      priorities = priorities.map((p) =>
        p.muscle === m ? { muscle: m, objective: target } : p,
      );
    } else {
      priorities = [...priorities, { muscle: m, objective: target }];
    }
    onChange({ priorities, maintenance });
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
    onChange({
      priorities: [...PRESET_DEFAULT_PRIORITIES],
      maintenance: new Set(PRESET_DEFAULT_MAINTENANCE),
    });
    onPresetApplied?.();
  }

  // Liste : prios (ordre de rang), puis maintiens et non-sélectionnés en
  // ordre anatomique (MUSCLES). Ordre stable → pas de lignes qui sautent
  // de façon imprévisible, mais le changement de section reste un feedback.
  const maintenanceRows = MUSCLES.filter((m) => draft.maintenance.has(m));
  const unselectedRows = MUSCLES.filter(
    (m) => muscleObjective(draft, m) === null,
  );
  const hasSelection =
    draft.priorities.length > 0 || draft.maintenance.size > 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl leading-tight tracking-wide text-white">
          Tes muscles cibles
          <HelpButton topic="deltoides" label="Aide : deltoïdes" />
        </h1>
        <p className="text-[12px] leading-relaxed text-anthracite-200">
          Choisis un objectif ci-dessous, puis touche les muscles sur la
          silhouette. Le premier muscle choisi compte le plus.
        </p>
        <details className="rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-[12px] leading-relaxed text-anthracite-200">
          <summary className="cursor-pointer text-white">
            Quel objectif choisir ?
          </summary>
          <ul className="mt-3 space-y-1.5 pl-1 text-anthracite-300">
            <li>
              <strong className="text-white">Hypertrophie</strong> — faire
              grossir le muscle. Le choix le plus courant : si tu hésites,
              prends ça.
            </li>
            <li>
              <strong className="text-white">Force</strong> — soulever lourd
              (reps basses, repos longs). Le muscle grossit aussi, mais moins.
            </li>
            <li>
              <strong className="text-white">Endurance</strong> — tenir long
              sans fatigue (reps hautes, charges légères).
            </li>
            <li>
              <strong className="text-white">Maintien</strong> — entretenir
              sans développer : juste assez de volume pour ne pas perdre.
            </li>
          </ul>
        </details>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={applyPreset}
          data-testid="preset-default"
        >
          Sélection par défaut (full-body)
        </Button>
        {hasSelection && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ priorities: [], maintenance: new Set<string>() })
            }
            data-testid="priorities-clear"
          >
            Tout retirer
          </Button>
        )}
      </div>

      <Card
        className="flex flex-col items-center gap-2 p-3"
        data-testid="step2-silhouette"
      >
        {/* Pinceau : objectif appliqué au prochain tap sur la silhouette. */}
        <div
          className="flex w-full gap-1"
          role="radiogroup"
          aria-label="Objectif à appliquer"
          data-testid="brush-selector"
        >
          {BRUSHES.map((obj) => {
            const ui = OBJECTIVE_UI[obj];
            const selected = brush === obj;
            return (
              <button
                key={obj}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setBrush(obj)}
                data-testid={`brush-${obj}`}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-1 py-1.5',
                  'text-[11px] font-medium transition',
                  selected
                    ? ui.chipActive
                    : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300 hover:text-white',
                )}
              >
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', ui.dot)}
                  aria-hidden="true"
                />
                {ui.label}
              </button>
            );
          })}
        </div>

        <AnatomicalSilhouette
          view="both"
          highlights={silhouetteHighlights}
          palette="objective"
          onMuscleClick={(m) => setMuscle(m, brush)}
          className="h-56"
          testId="onboarding-silhouette"
        />
        <p className="text-center text-[10px] leading-tight text-anthracite-300">
          Touche un muscle pour lui appliquer l'objectif choisi ; retouche-le
          pour le retirer.
        </p>
      </Card>

      <Card className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Tous les muscles</span>
          <span className="text-xs text-anthracite-300 tabular-nums">
            {draft.priorities.length + draft.maintenance.size} / {MUSCLES.length}
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={draft.priorities.map((p) => p.muscle)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1.5" data-testid="muscles-list">
              {draft.priorities.map((p, i) => (
                <SortableMuscleRow
                  key={p.muscle}
                  rank={i + 1}
                  muscle={p.muscle}
                  objective={p.objective}
                  onSet={(obj) => setMuscle(p.muscle, obj)}
                />
              ))}
              {maintenanceRows.map((m) => (
                <MuscleRow
                  key={m}
                  muscle={m}
                  objective={MuscleObjective.MAINTIEN}
                  onSet={(obj) => setMuscle(m, obj)}
                />
              ))}
              {unselectedRows.map((m) => (
                <MuscleRow
                  key={m}
                  muscle={m}
                  objective={null}
                  onSet={(obj) => setMuscle(m, obj)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}

interface MuscleRowProps {
  readonly muscle: Muscle | string;
  readonly objective: MuscleObjective | null;
  readonly onSet: (obj: MuscleObjective | null) => void;
  /** Rang affiché (prioritaires uniquement). */
  readonly rank?: number;
}

/** Contrôle 5 positions (– / H / F / E / M) d'une ligne muscle. */
function ObjectiveControl({
  muscle,
  objective,
  onSet,
}: Omit<MuscleRowProps, 'rank'>) {
  return (
    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Objectif ${muscleLabel(muscle)}`}>
      <button
        type="button"
        role="radio"
        aria-checked={objective === null}
        aria-label="Aucun"
        onClick={() => onSet(null)}
        data-testid={`obj-${muscle}-none`}
        className={cn(
          'h-7 w-7 rounded border text-[11px] font-semibold transition',
          objective === null
            ? 'border-anthracite-500 bg-anthracite-700 text-white'
            : 'border-anthracite-700 bg-anthracite-800 text-anthracite-400 hover:text-white',
        )}
      >
        –
      </button>
      {BRUSHES.map((obj) => {
        const ui = OBJECTIVE_UI[obj];
        const active = objective === obj;
        return (
          <button
            key={obj}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ui.label}
            onClick={() => onSet(obj)}
            data-testid={`obj-${muscle}-${obj}`}
            className={cn(
              'h-7 w-7 rounded border text-[11px] font-semibold transition',
              active
                ? ui.chipActive
                : 'border-anthracite-700 bg-anthracite-800 text-anthracite-400 hover:text-white',
            )}
          >
            {ui.letter}
          </button>
        );
      })}
    </div>
  );
}

/** Ligne non-prioritaire (maintien ou non sélectionné) — pas de drag. */
function MuscleRow({ muscle, objective, onSet }: MuscleRowProps) {
  const ui = objective !== null ? OBJECTIVE_UI[objective] : null;
  return (
    <li
      data-testid={`muscle-row-${muscle}`}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-anthracite-900 p-1.5',
        objective !== null ? 'border-anthracite-600' : 'border-anthracite-700',
      )}
    >
      <span className="w-7 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-white">
        {ui !== null && (
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', ui.dot)}
            aria-hidden="true"
          />
        )}
        {muscleLabel(muscle)}
      </span>
      <ObjectiveControl muscle={muscle} objective={objective} onSet={onSet} />
    </li>
  );
}

/** Ligne prioritaire : rang visible + poignée de drag pour réordonner. */
function SortableMuscleRow({ rank, muscle, objective, onSet }: MuscleRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: muscle });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const ui = objective !== null ? OBJECTIVE_UI[objective] : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`muscle-row-${muscle}`}
      className="flex items-center gap-2 rounded-lg border border-anthracite-600 bg-anthracite-900 p-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Déplacer"
        data-testid={`drag-${muscle}`}
        // touch-none indispensable : sans ça, le navigateur traite le touch
        // comme un scroll et le PointerSensor ne reçoit pas l'événement.
        className="flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-anthracite-300 hover:text-white active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-white">
        <span className="shrink-0 text-xs font-semibold text-sang-500 tabular-nums">
          {rank}
        </span>
        {ui !== null && (
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', ui.dot)}
            aria-hidden="true"
          />
        )}
        {muscleLabel(muscle)}
      </span>
      <ObjectiveControl muscle={muscle} objective={objective} onSet={onSet} />
    </li>
  );
}
