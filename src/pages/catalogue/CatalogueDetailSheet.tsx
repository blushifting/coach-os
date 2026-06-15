import { useState, type ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { ChargeMechanicNote } from '@/components/ChargeMechanicNote';
import { Concept } from '@/components/Concept';
import { Dialog } from '@/components/Dialog';
import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import {
  buildDescription,
  displayExerciseName,
  equipLabel,
  extypeLabel,
  kgUnitLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { cn } from '@/lib/cn';
import { muscleLabel } from '@/lib/progress';
import { formatRest } from '@/lib/session-runner';
import { useCoachOsStore } from '@/store';
import { useDemoMode, useGymBrand } from '@/store/selectors';
import { ManualE1rmSheet } from '@/pages/seance/ManualE1rmSheet';
import { ChargeBadge } from './ChargeBadge';
import { ExercisePhoto } from './ExercisePhoto';
import { EquipmentOverrideSheet } from './EquipmentOverrideSheet';
import { FavoriteStar } from './FavoriteStar';

interface CatalogueDetailSheetProps {
  readonly open: boolean;
  readonly exercise: Exercise | null;
  /** Plafond mesuré pour cet exo (kg) — null si jamais mesuré (Conv #11g). */
  readonly e1rm?: number | null;
  readonly onClose: () => void;
}

/**
 * Sheet de détail Catalogue — Conv #10d.
 *
 * Refonte : silhouette grande face+dos centrée en haut, descriptif riche
 * dessous (muscles primaires/synergistes, matériel, repos / reps recommandées,
 * difficulté, variantes tag).
 */
export function CatalogueDetailSheet({
  open,
  exercise,
  e1rm = null,
  onClose,
}: CatalogueDetailSheetProps) {
  // Conv #17 — édition plafond hors séance : bouton qui ouvre `ManualE1rmSheet`
  // par-dessus le détail. Verrouillé en démo (mutations DB interdites). On lit
  // bodyweight + demoActive systématiquement (hooks ne peuvent pas être
  // conditionnels) ; le `exercise === null` early-return est traité ensuite.
  const [manualOpen, setManualOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  // Conv #21b-fix — Suppression d'un exo custom. Le bouton n'apparaît que
  // si l'exo est dans `customExerciseIds` (= ajouté par l'user, pas
  // catalogue par défaut). Dialog de confirmation parce que c'est destructif.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bodyweightKg = useCoachOsStore(
    (s) => s.userState?.profile.bodyweight_kg ?? 75,
  );
  const hasOverride = useCoachOsStore(
    (s) => exercise !== null && s.userState?.equipment_overrides[exercise.id] !== undefined,
  );
  const isCustom = useCoachOsStore(
    (s) => exercise !== null && s.customExerciseIds.has(exercise.id),
  );
  const engine = useEngine();
  const demoActive = useDemoMode();
  const brand = useGymBrand();
  // Bloc F (Conv #31) — état favori unifié (étoile catalogue/fiche).
  const isFavorite = useCoachOsStore(
    (s) =>
      exercise !== null &&
      (s.userState?.favorite_exercise_ids ?? []).includes(exercise.id),
  );

  if (exercise === null) return null;
  const displayName = displayExerciseName(exercise, brand ?? undefined);

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

  const repsRange = exercise.reps_hyp;
  const repsForce = exercise.reps_force;

  return (
    <Sheet open={open} onClose={onClose} title={displayName}>
      <div className="flex flex-col gap-4" data-testid="catalogue-detail-content">
        <div className="flex justify-center">
          <AnatomicalSilhouette
            highlights={highlights}
            view="both"
            className="h-56 w-auto"
            testId="catalogue-detail-silhouette"
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

        {/* Bloc F (Conv #31) — bascule favori. Désactivée en démo (pas
            d'écriture DB). */}
        <button
          type="button"
          onClick={() => void engine.toggleFavorite(exercise.id)}
          disabled={demoActive}
          aria-pressed={isFavorite}
          data-testid={`catalogue-detail-fav-${exercise.id}`}
          className={cn(
            'mx-auto flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-50',
            isFavorite
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-anthracite-700 text-anthracite-200 hover:border-anthracite-500',
          )}
        >
          <FavoriteStar filled={isFavorite} size={18} />
          {isFavorite ? 'Dans tes favoris' : 'Ajouter aux favoris'}
        </button>

        <p
          className="text-sm leading-relaxed text-anthracite-100"
          data-testid="catalogue-detail-description"
        >
          {buildDescription(exercise)}
        </p>

        {/* Bloc F (Conv #31) — mécanique de charge (assisté = poids retiré…). */}
        <ChargeMechanicNote charge={exercise.charge} />

        {e1rm !== null && e1rm > 0 ? (
          <div
            data-testid="catalogue-detail-e1rm"
            className="flex items-baseline justify-between rounded-xl border border-sang-700/40 bg-sang-900/25 px-3 py-2"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-sang-300">
              Ton <Concept topic="plafond">Plafond</Concept>
            </span>
            <span className="font-display text-xl tabular-nums text-white">
              {e1rm.toFixed(1)} {kgUnitLabel(exercise.charge)}
            </span>
          </div>
        ) : null}

        {/* Conv #17 — édition manuelle hors séance. Disponible que l'exo soit
            déjà calibré ou non (label adapte le verbe). Désactivé en démo. */}
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={demoActive}
          data-testid={`btn-edit-plafond-${exercise.id}`}
          onClick={() => setManualOpen(true)}
        >
          {e1rm !== null && e1rm > 0
            ? 'Modifier mon Plafond'
            : 'Je connais mon Plafond'}
        </Button>

        <ManualE1rmSheet
          open={manualOpen}
          exercise={exercise}
          bodyweightKg={bodyweightKg}
          onClose={() => setManualOpen(false)}
        />

        {/* Conv #18 — Personnalisation des bornes d'équipement (inc/min/max
            par exo). Bouton secondaire car secondaire vis-à-vis du plafond. */}
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          disabled={demoActive}
          data-testid={`btn-edit-equip-${exercise.id}`}
          onClick={() => setOverrideOpen(true)}
        >
          {hasOverride
            ? 'Bornes d\'équipement personnalisées ✓'
            : 'Personnaliser les bornes d\'équipement'}
        </Button>

        <EquipmentOverrideSheet
          open={overrideOpen}
          exercise={exercise}
          onClose={() => setOverrideOpen(false)}
        />

        {primaires.length > 0 && (
          <Section label="Muscles principaux">
            <div className="flex flex-wrap gap-1" data-testid="catalogue-muscles-primaires">
              {primaires.map((m) => (
                <span
                  key={m}
                  className="rounded bg-sang-900/40 px-2 py-0.5 text-xs text-white"
                >
                  {muscleLabel(m)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {synergistes.length > 0 && (
          <Section label="Muscles secondaires">
            <div className="flex flex-wrap gap-1" data-testid="catalogue-muscles-synergistes">
              {synergistes.map((m) => (
                <span
                  key={m}
                  className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white"
                >
                  {muscleLabel(m)}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section label="Recommandations">
          <ul
            className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-anthracite-100"
            data-testid="catalogue-recommandations"
          >
            <li className="flex justify-between">
              <span className="text-anthracite-300">Reps hypertrophie</span>
              <span className="tabular-nums">
                {repsRange[0]}–{repsRange[1]}
              </span>
            </li>
            {repsForce !== null && (
              <li className="flex justify-between">
                <span className="text-anthracite-300">Reps force</span>
                <span className="tabular-nums">
                  {repsForce[0]}–{repsForce[1]}
                </span>
              </li>
            )}
            <li className="flex justify-between">
              <span className="text-anthracite-300">Repos</span>
              <span className="tabular-nums">{formatRest(exercise.repos_s)}</span>
            </li>
            {/* Conv #20 — "Difficulté" retirée : étiquette subjective qui
                n'aide pas l'user à choisir. Le champ data `dif` reste pour
                le tie-break interne de `selection.ts` (préférence aux exos
                faciles à équivalence de couverture). */}
          </ul>
        </Section>

        {exercise.equip.length > 0 && (
          <Section label="Matériel requis">
            <div className="flex flex-wrap gap-1" data-testid="catalogue-equip">
              {exercise.equip.map((e) => (
                <span
                  key={e}
                  className="rounded border border-anthracite-700 px-2 py-0.5 text-xs text-anthracite-100"
                >
                  {equipLabel(e)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {tags.length > 0 && (
          <Section label="Variantes">
            <div className="flex flex-wrap gap-1" data-testid="catalogue-tags">
              {tags.map(([key, label]) => (
                <span
                  key={key}
                  className="rounded border border-anthracite-700 px-2 py-0.5 text-xs text-anthracite-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Conv #21b-fix — Bouton "Supprimer cet exo" pour les customs
            uniquement. Les exos du catalogue par défaut ne sont jamais
            supprimables (ils font partie du socle, on n'a pas envie de les
            perdre). Désactivé en mode démo. */}
        {isCustom && (
          <div
            className="mt-2 border-t border-anthracite-700 pt-3"
            data-testid="catalogue-detail-custom-actions"
          >
            <p className="mb-2 text-[11px] leading-snug text-anthracite-400">
              Cet exercice a été ajouté par toi. Tu peux le retirer du
              catalogue — tes séances passées resteront, mais l'exercice
              s'affichera sous son code.
            </p>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              disabled={demoActive || deleting}
              data-testid={`btn-delete-custom-${exercise.id}`}
              onClick={() => setConfirmDelete(true)}
            >
              {deleting ? 'Suppression…' : 'Supprimer cet exercice'}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={confirmDelete}
        title="Supprimer cet exercice ?"
        description={
          <>
            L'exercice <strong>{displayName}</strong> sera retiré du
            catalogue. Les séances passées qui le référencent garderont
            leurs données, mais le nom de l'exercice n'apparaîtra plus.
          </>
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        destructive
        onConfirm={async () => {
          setConfirmDelete(false);
          setDeleting(true);
          try {
            await engine.removeCustomExercise(exercise.id);
            onClose();
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}

function Section({
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
