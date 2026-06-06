import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import type { Catalog } from '@/engine/catalog';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import {
  buildDescription,
  chargeLabel,
  equipLabel,
  extypeLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { alternativeVariantsFor } from '@/lib/calibration';
import { muscleLabel } from '@/lib/progress';
import { formatRest } from '@/lib/session-runner';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { PatternIcon } from './PatternIcon';
import { ChargeIcon } from '@/pages/catalogue/ChargeIcon';
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

  const brand = useGymBrand();
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
            <PatternIcon pattern={exercise.pattern} size="sm" />
            <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              {extypeLabel(exercise.type)}
            </span>
            <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              {patternLabel(exercise.pattern)}
            </span>
            <span className="flex items-center gap-1 rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              <ChargeIcon charge={exercise.charge} size={13} />
              {chargeLabel(exercise.charge)}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-anthracite-100">
            {buildDescription(exercise)}
          </p>

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
            <SectionBlock label="Synergistes">
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

          <SectionBlock label="Recommandations">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-anthracite-100">
              <li className="flex justify-between">
                <span className="text-anthracite-300">Reps hypertrophie</span>
                <span className="tabular-nums">
                  {exercise.reps_hyp[0]}–{exercise.reps_hyp[1]}
                </span>
              </li>
              {exercise.reps_force !== null && (
                <li className="flex justify-between">
                  <span className="text-anthracite-300">Reps force</span>
                  <span className="tabular-nums">
                    {exercise.reps_force[0]}–{exercise.reps_force[1]}
                  </span>
                </li>
              )}
              <li className="flex justify-between">
                <span className="text-anthracite-300">Repos</span>
                <span className="tabular-nums">{formatRest(exercise.repos_s)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-anthracite-300">Difficulté</span>
                <span>{exercise.dif || '—'}</span>
              </li>
            </ul>
          </SectionBlock>

          {exercise.equip.length > 0 && (
            <SectionBlock label="Matériel requis">
              <div className="flex flex-wrap gap-1">
                {exercise.equip.map((e) => (
                  <span
                    key={e}
                    className="rounded border border-anthracite-700 px-2 py-0.5 text-xs text-anthracite-100"
                  >
                    {equipLabel(e)}
                  </span>
                ))}
              </div>
            </SectionBlock>
          )}

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
              {replacing ? 'Remplacement…' : 'Remplacer cet exo'}
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
          title="Remplacer cet exo"
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
