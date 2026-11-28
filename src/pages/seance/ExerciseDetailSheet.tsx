import { useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { ChargeMechanicNote } from '@/components/ChargeMechanicNote';
import { ExerciseNoteField } from '@/components/ExerciseNoteField';
import type { Catalog } from '@/engine/catalog';
import { alternativeVariantsFor } from '@/lib/calibration';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { ChargeBadge } from '@/pages/catalogue/ChargeBadge';
import { ExerciseVisual } from '@/pages/catalogue/ExerciseVisual';
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
   * affiché en bas de la sheet. Si absent, mode lecture seule.
   */
  readonly onReplace?: (newExerciseId: string) => Promise<void> | void;
}

/**
 * Fiche détaillée d'un exo (séance en cours OU plan en preview).
 *
 * Alignée sur `CatalogueDetailSheet` (même haut de fiche, `ExerciseVisual`),
 * plus un bouton « Remplacer cet exercice » si `onReplace` est fourni.
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
  // Protection démo : le remplacement d'exo écrit en DB
  // (replaceSessionExercise) donc on désactive le bouton en mode démo.
  const demoActive = useDemoMode();
  // DOIT rester au-dessus du `return null` ci-dessous : avant,
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
      <Sheet
        open={open}
        onClose={onClose}
        title={displayName}
        subtitle={displayName !== exercise.nom_fr ? exercise.nom_fr : undefined}
        leading={<ChargeBadge charge={exercise.charge} size={32} />}
      >
        <div className="flex flex-col gap-4" data-testid="exercise-detail-content">
          <ExerciseVisual exercise={exercise} testIdPrefix="exercise-detail" />

          <ExerciseNoteField exerciseId={exercise.id} />

          {/* Une vraie note d'exercice (exercices créés, rares notes du catalogue). */}
          {exercise.note && exercise.note.trim() !== '' && (
            <p className="text-sm leading-relaxed text-anthracite-100">
              {exercise.note.trim()}
            </p>
          )}

          {/* Mécanique de charge (assisté/lesté/PdC). */}
          <ChargeMechanicNote charge={exercise.charge} />

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
