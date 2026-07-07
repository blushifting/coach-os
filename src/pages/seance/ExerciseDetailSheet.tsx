import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { ChargeMechanicNote } from '@/components/ChargeMechanicNote';
import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import type { Catalog } from '@/engine/catalog';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import {
  extypeLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { alternativeVariantsFor } from '@/lib/calibration';
import { muscleLabel } from '@/lib/progress';
import { formatRest } from '@/lib/session-runner';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { ExercisePhoto } from '@/pages/catalogue/ExercisePhoto';
import { VariantPickerSheet } from '@/components/VariantPickerSheet';
import { displayExerciseName } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';

interface ExerciseDetailSheetProps {
  readonly open: boolean;
  readonly exerciseId: string | null;
  readonly catalog: Catalog | null;
  readonly onClose: () => void;
  /**
   * Callback de remplacement. Si fourni, un bouton "Remplacer cet exo" est
   * affiché en bas de la sheet (cf. Conv #10d). Si absent, mode lecture seule.
   */
  readonly onReplace?: (newExerciseId: string) => Promise<void> | void;
}

/**
 * Fiche détaillée d'un exo (séance en cours OU plan en preview).
 *
 * Conv #10d : refonte alignée avec `CatalogueDetailSheet` (silhouette grande,
 * sections riches) + bouton "Remplacer cet exo" si `onReplace` est fourni.
 * Le remplacement utilise `alternativeVariantsFor` en mode élargi par défaut
 * (toggle dans le picker pour restreindre aux variantes proches).
 */
export function ExerciseDetailSheet({
  open,
  exerciseId,
  catalog,
  onClose,
  onReplace,
}: ExerciseDetailSheetProps) {
  const equipment = useCoachOsStore(
    (s) => s.userState?.profile.available_equip ?? null,
  );
  // Conv #17 — protection démo : le remplacement d'exo écrit en DB
  // (replaceSessionExercise) donc on désactive le bouton en mode démo.
  const demoActive = useDemoMode();
  // Conv #24 (D10) — DOIT rester au-dessus du `return null` ci-dessous : avant,
  // ce hook était appelé après l'early-return `if (exercise === null)`, donc
  // le nombre de hooks changeait à l'ouverture de la sheet (exercise null →
  // non-null) → React plantait (« Rendered more hooks… ») au clic sur « i ».
  const brand = useGymBrand();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mode élargi par défaut : Azur veut beaucoup de flexibilité en séance.
  const [expanded, setExpanded] = useState(true);
  const [replacing, setReplacing] = useState(false);

  const exercise = useMemo(() => {
    if (exerciseId === null || catalog === null) return null;
    try {
      return catalog.get(exerciseId);
    } catch {
      return null;
    }
  }, [exerciseId, catalog]);

  const alternatives = useMemo(() => {
    if (exercise === null || catalog === null) return [];
    const eq = equipment ?? new Set<string>();
    return alternativeVariantsFor(exercise.id, eq, catalog, { expand: expanded });
  }, [exercise, catalog, equipment, expanded]);

  if (exercise === null) return null;

  const primaires = exercisePrimaires(exercise);
  const synergistes = exerciseSynergistes(exercise);
  const tags = exercise.tags
    .map((t) => [t, tagLabel(t)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);

  const highlights: Record<string, SilhouetteStatus> = {};
  for (const [m, coef] of Object.entries(exercise.muscles)) {
    if (coef >= 1.0) highlights[m] = 'highlight';
    else if (coef >= 0.5) highlights[m] = 'synergist';
  }

  async function handlePickReplacement(newExId: string) {
    if (onReplace === undefined) return;
    setReplacing(true);
    try {
      await onReplace(newExId);
      setPickerOpen(false);
      onClose();
    } finally {
      setReplacing(false);
    }
  }

  const displayName = displayExerciseName(exercise, brand ?? undefined);

  return (
    <>
      <Sheet open={open} onClose={onClose} title={displayName}>
        <div className="flex flex-col gap-4" data-testid="exercise-detail-content">
          <div className="flex justify-center">
            <AnatomicalSilhouette
              highlights={highlights}
              view="both"
              className="h-44 w-auto"
              testId="exercise-detail-silhouette"
            />
          </div>

          <ExercisePhoto exerciseId={exercise.id} />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <ChargeBadge charge={exercise.charge} size={32} />
            <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              {extypeLabel(exercise.type)}
            </span>
            <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              {patternLabel(exercise.pattern)}
            </span>
          </div>

          {/* E-4 — description auto retirée (redondante avec le badge type/
              pattern ci-dessus et les sections Muscles ci-dessous). On garde
              seulement une vraie note d'exo si elle existe. */}
          {exercise.note && exercise.note.trim() !== '' && (
            <p className="text-sm leading-relaxed text-anthracite-100">
              {exercise.note.trim()}
            </p>
          )}

          {/* Bloc F (Conv #31) — mécanique de charge (assisté/lesté/PdC). */}
          <ChargeMechanicNote charge={exercise.charge} />

          {primaires.length > 0 && (
            <SectionBlock label="Muscles principaux">
              <div className="flex flex-wrap gap-1">
                {primaires.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-sang-900/40 px-2 py-0.5 text-xs text-white"
                  >
                    {muscleLabel(m)}
                  </span>
                ))}
              </div>
            </SectionBlock>
          )}

          {synergistes.length > 0 && (
            <SectionBlock label="Muscles secondaires">
              <div className="flex flex-wrap gap-1">
                {synergistes.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white"
                  >
                    {muscleLabel(m)}
                  </span>
                ))}
              </div>
            </SectionBlock>
          )}

          {/* E-4 — « Reps hypertrophie/force » retirées (l'app gère les reps ;
              déjà absentes du catalogue depuis Conv #52). La section se réduit
              au repos conseillé, alignée sur la fiche Catalogue. */}
          <SectionBlock label="Repos conseillé">
            <p className="flex justify-between text-xs text-anthracite-100">
              <span className="text-anthracite-300">Entre séries</span>
              <span className="tabular-nums">{formatRest(exercise.repos_s)}</span>
            </p>
          </SectionBlock>

          {tags.length > 0 && (
            <SectionBlock label="Variantes">
              <div className="flex flex-wrap gap-1">
                {tags.map(([key, label]) => (
                  <span
                    key={key}
                    className="rounded border border-anthracite-700 px-2 py-0.5 text-xs text-anthracite-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </SectionBlock>
          )}

          {onReplace !== undefined && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setPickerOpen(true)}
              disabled={replacing || demoActive}
              data-testid="btn-replace-exercise"
              title={demoActive ? 'Désactivé en mode démo' : undefined}
            >
              {replacing ? 'Remplacement…' : 'Remplacer cet exercice'}
            </Button>
          )}
        </div>
      </Sheet>

      {onReplace !== undefined && (
        <VariantPickerSheet
          open={pickerOpen}
          currentExerciseId={exercise.id}
          alternatives={alternatives}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
          onPick={handlePickReplacement}
          onClose={() => setPickerOpen(false)}
          title="Remplacer cet exercice"
        />
      )}
    </>
  );
}

function SectionBlock({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-anthracite-300">{label}</span>
      {children}
    </div>
  );
}
