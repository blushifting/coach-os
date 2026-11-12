/**
 * Étape 2 de l'onboarding (refonte Conv #28, dump 2.4) : muscles + intention.
 *
 * Modèle « pinceau » : un sélecteur d'intention (Développer / Entretenir)
 * au-dessus de la silhouette ; taper un muscle lui applique l'intention
 * courante, retaper avec le même pinceau la retire. Un muscle sans intention
 * reste suivi (D1), sans cible.
 *
 * `priority_rank` reste alimenté pour les muscles à développer : rang = ordre
 * de sélection, visible (numéro) et réordonnable (poignée de drag) dans la
 * liste sous la silhouette.
 *
 * La liste des 15 muscles est l'autre vue du même état : muscles à développer
 * en tête (ordre de rang), à entretenir ensuite, sans intention en ordre
 * anatomique. Chaque ligne porte un contrôle 3 positions (– / D / E).
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
import { MUSCLES, MuscleIntention, type Muscle } from '@/engine/models';
import {
  AnatomicalSilhouette,
  type SilhouetteStatus,
} from '@/components/AnatomicalSilhouette';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
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

/** Style par intention — voir la doc palette `objective` de la silhouette. */
const INTENTION_UI: Record<
  MuscleIntention,
  {
    readonly label: string;
    readonly letter: string;
    readonly dot: string;
    readonly chipActive: string;
    readonly silhouette: SilhouetteStatus;
  }
> = {
  [MuscleIntention.DEVELOPPER]: {
    label: 'Développer',
    letter: 'D',
    dot: 'bg-amber-400',
    chipActive: 'border-amber-400 bg-amber-400/15 text-amber-300',
    silhouette: 'highlight',
  },
  [MuscleIntention.ENTRETENIR]: {
    label: 'Entretenir',
    letter: 'E',
    dot: 'bg-amber-700',
    chipActive: 'border-amber-700 bg-amber-700/20 text-amber-600',
    silhouette: 'ok',
  },
};

const BRUSHES: readonly MuscleIntention[] = [
  MuscleIntention.DEVELOPPER,
  MuscleIntention.ENTRETENIR,
];

/** Intention courante d'un muscle dans le draft, ou `null` s'il n'en a pas. */
function muscleIntention(
  draft: OnboardingDraft,
  m: string,
): MuscleIntention | null {
  if (draft.priorities.some((p) => p.muscle === m)) return MuscleIntention.DEVELOPPER;
  if (draft.maintenance.has(m)) return MuscleIntention.ENTRETENIR;
  return null;
}

export function Step2Muscles({ draft, onChange, onPresetApplied }: Step2Props) {
  const [brush, setBrush] = useState<MuscleIntention>(MuscleIntention.DEVELOPPER);

  const silhouetteHighlights = useMemo(() => {
    const out: Record<string, SilhouetteStatus> = {};
    for (const p of draft.priorities) {
      out[p.muscle] = INTENTION_UI[MuscleIntention.DEVELOPPER].silhouette;
    }
    for (const m of draft.maintenance) {
      out[m] = INTENTION_UI[MuscleIntention.ENTRETENIR].silhouette;
    }
    return out;
  }, [draft.priorities, draft.maintenance]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Applique `intention` au muscle `m` (ou la retire si c'est déjà son état,
   * ou si `intention` est null). Un muscle déjà à développer garde son rang.
   */
  function setMuscle(m: string, intention: MuscleIntention | null) {
    const current = muscleIntention(draft, m);
    const target = current === intention ? null : intention;

    const maintenance = new Set(draft.maintenance);
    maintenance.delete(m);
    let priorities: readonly RankedPriority[] = draft.priorities;

    if (target === MuscleIntention.DEVELOPPER) {
      if (!priorities.some((p) => p.muscle === m)) {
        priorities = [...priorities, { muscle: m }];
      }
    } else {
      priorities = priorities.filter((p) => p.muscle !== m);
      if (target === MuscleIntention.ENTRETENIR) maintenance.add(m);
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

  // Liste : à développer (ordre de rang), puis à entretenir et sans intention en
  // ordre anatomique (MUSCLES). Ordre stable → pas de lignes qui sautent
  // de façon imprévisible, mais le changement de section reste un feedback.
  const maintenanceRows = MUSCLES.filter((m) => draft.maintenance.has(m));
  const unselectedRows = MUSCLES.filter(
    (m) => muscleIntention(draft, m) === null,
  );
  const hasSelection =
    draft.priorities.length > 0 || draft.maintenance.size > 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Tes muscles cibles
        </h1>
        <p className="text-sm leading-relaxed text-anthracite-300">
          Choisis les muscles à développer, et ceux à entretenir.
        </p>
        <details className="rounded-xl border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-xs leading-relaxed text-anthracite-200">
          <summary className="cursor-pointer text-white">
            Que choisir pour chaque muscle&nbsp;?
          </summary>
          <ul className="mt-3 space-y-1.5 pl-1 text-anthracite-300">
            <li>
              <strong className="text-white">Développer</strong> — faire
              progresser ce muscle.
            </li>
            <li>
              <strong className="text-white">Entretenir</strong> — maintenir ce
              muscle à son niveau.
            </li>
            <li>
              <strong className="text-white">Sans objectif</strong> — muscle
              travaillé occasionnellement, pas en priorité.
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
        {/* Pinceau : intention appliquée au prochain tap sur la silhouette. */}
        <div
          className="flex w-full gap-1"
          role="radiogroup"
          aria-label="Choix à appliquer"
          data-testid="brush-selector"
        >
          {BRUSHES.map((intention) => {
            const ui = INTENTION_UI[intention];
            const selected = brush === intention;
            return (
              <button
                key={intention}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setBrush(intention)}
                data-testid={`brush-${intention}`}
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
          Touche un muscle pour lui appliquer ce choix&nbsp;; retouche pour le
          retirer.
        </p>
      </Card>

      <Card className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Ordre de priorité</span>
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
                  intention={MuscleIntention.DEVELOPPER}
                  onSet={(i) => setMuscle(p.muscle, i)}
                />
              ))}
              {maintenanceRows.map((m) => (
                <MuscleRow
                  key={m}
                  muscle={m}
                  intention={MuscleIntention.ENTRETENIR}
                  onSet={(i) => setMuscle(m, i)}
                />
              ))}
              {unselectedRows.map((m) => (
                <MuscleRow
                  key={m}
                  muscle={m}
                  intention={null}
                  onSet={(i) => setMuscle(m, i)}
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
  readonly intention: MuscleIntention | null;
  readonly onSet: (intention: MuscleIntention | null) => void;
  /** Rang affiché (muscles à développer uniquement). */
  readonly rank?: number;
}

/** Contrôle 3 positions (– / D / E) d'une ligne muscle. */
function IntentionControl({
  muscle,
  intention,
  onSet,
}: Omit<MuscleRowProps, 'rank'>) {
  return (
    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Choix pour ${muscleLabel(muscle)}`}>
      <button
        type="button"
        role="radio"
        aria-checked={intention === null}
        aria-label="Sans objectif"
        onClick={() => onSet(null)}
        data-testid={`obj-${muscle}-none`}
        className={cn(
          'h-7 w-7 rounded border text-[11px] font-semibold transition',
          intention === null
            ? 'border-anthracite-500 bg-anthracite-700 text-white'
            : 'border-anthracite-700 bg-anthracite-800 text-anthracite-400 hover:text-white',
        )}
      >
        –
      </button>
      {BRUSHES.map((b) => {
        const ui = INTENTION_UI[b];
        const active = intention === b;
        return (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ui.label}
            onClick={() => onSet(b)}
            data-testid={`obj-${muscle}-${b}`}
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

/** Ligne à entretenir ou sans intention — pas de drag. */
function MuscleRow({ muscle, intention, onSet }: MuscleRowProps) {
  const ui = intention !== null ? INTENTION_UI[intention] : null;
  return (
    <li
      data-testid={`muscle-row-${muscle}`}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-anthracite-900 p-1.5',
        intention !== null ? 'border-anthracite-600' : 'border-anthracite-700',
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
      <IntentionControl muscle={muscle} intention={intention} onSet={onSet} />
    </li>
  );
}

/** Ligne à développer : rang visible + poignée de drag pour réordonner. */
function SortableMuscleRow({ rank, muscle, intention, onSet }: MuscleRowProps) {
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

  const ui = intention !== null ? INTENTION_UI[intention] : null;

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
      <IntentionControl muscle={muscle} intention={intention} onSet={onSet} />
    </li>
  );
}
