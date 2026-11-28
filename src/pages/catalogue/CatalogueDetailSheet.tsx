import { useState, type ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { ChargeMechanicNote } from '@/components/ChargeMechanicNote';
import { Concept } from '@/components/Concept';
import { Dialog } from '@/components/Dialog';
import { ExerciseNoteField } from '@/components/ExerciseNoteField';
import { Pattern } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import {
  displayExerciseName,
  extypeLabel,
  kgUnitLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { cn } from '@/lib/cn';
import { formatRest } from '@/lib/session-runner';
import { useCoachOsStore } from '@/store';
import { useDemoMode, useGymBrand } from '@/store/selectors';
import { ManualE1rmSheet } from '@/pages/seance/ManualE1rmSheet';
import { ChargeBadge } from './ChargeBadge';
import { ExerciseVisual } from './ExerciseVisual';
import { EquipmentOverrideSheet } from './EquipmentOverrideSheet';
import { FavoriteStar } from './FavoriteStar';
import { RepRangePicker } from './RepRangePicker';

interface CatalogueDetailSheetProps {
  readonly open: boolean;
  readonly exercise: Exercise | null;
  /** Plafond mesuré pour cet exo (kg) — null si jamais mesuré. */
  readonly e1rm?: number | null;
  readonly onClose: () => void;
}

/**
 * Sheet de détail Catalogue — Conv #10d.
 *
 * En haut, l'animation du mouvement et les muscles travaillés (`ExerciseVisual`,
 * repli sur la silhouette et les photos) ; dessous, la note, le Plafond, la
 * fourchette, les réglages de charge, le repos et les variantes.
 */
export function CatalogueDetailSheet({
  open,
  exercise,
  e1rm = null,
  onClose,
}: CatalogueDetailSheetProps) {
  // Édition plafond hors séance : bouton qui ouvre `ManualE1rmSheet`
  // par-dessus le détail. Verrouillé en démo (mutations DB interdites). On lit
  // bodyweight + demoActive systématiquement (hooks ne peuvent pas être
  // conditionnels) ; le `exercise === null` early-return est traité ensuite.
  const [manualOpen, setManualOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  // Suppression d'un exo custom. Le bouton n'apparaît que
  // si l'exo est dans `customExerciseIds` (= ajouté par l'user, pas
  // catalogue par défaut). Dialog de confirmation parce que c'est destructif.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Réinitialisation du plafond (efface mesure + historique e1RM).
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
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
  // État favori unifié (étoile catalogue/fiche).
  const isFavorite = useCoachOsStore(
    (s) =>
      exercise !== null &&
      (s.userState?.favorite_exercise_ids ?? []).includes(exercise.id),
  );

  if (exercise === null) return null;
  const displayName = displayExerciseName(exercise, brand ?? undefined);

  const tags = exercise.tags
    .map((t) => [t, tagLabel(t)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);

  return (
    <Sheet open={open} onClose={onClose} title={displayName}>
      <div className="flex flex-col gap-4" data-testid="catalogue-detail-content">
        <ExerciseVisual exercise={exercise} testIdPrefix="catalogue" silhouetteClassName="h-56 w-auto" />

        <ExerciseNoteField exerciseId={exercise.id} />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <ChargeBadge charge={exercise.charge} size={32} />
          <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
            {extypeLabel(exercise.type)}
          </span>
          {/* Point 1 — pattern « isolation » = redondant avec le type « Isolation » : on masque. */}
          {exercise.pattern !== Pattern.ISOLATION && (
            <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
              {patternLabel(exercise.pattern)}
            </span>
          )}
        </div>

        {/* Bascule favori. Désactivée en démo (pas
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

        {/* Description auto retirée (redondante : « polyarticulaire/
            isolation » = badge ci-dessus, « Muscles ciblés » = sections
            Muscles ci-dessous). On garde seulement une vraie note d'exo
            (exos custom + rares notes catalogue). */}
        {exercise.note && exercise.note.trim() !== '' && (
          <p
            className="text-justify text-sm leading-relaxed text-anthracite-100"
            data-testid="catalogue-detail-description"
          >
            {exercise.note.trim()}
          </p>
        )}

        {/* Mécanique de charge (assisté = poids retiré…). */}
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

        {/* Fourchette de reps de l'exercice. */}
        <RepRangePicker exercise={exercise} />

        {/* Édition manuelle hors séance. Disponible que l'exo soit
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

        {/* Réinitialiser le plafond : efface la mesure + l'historique
            e1RM → l'exo repart en calibration. Affiché seulement s'il est calibré. */}
        {e1rm !== null && e1rm > 0 && (
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            disabled={demoActive || resetting}
            data-testid={`btn-reset-plafond-${exercise.id}`}
            onClick={() => setConfirmReset(true)}
          >
            {resetting ? 'Réinitialisation…' : 'Réinitialiser mon Plafond'}
          </Button>
        )}

        {/* Personnalisation des bornes d'équipement (inc/min/max
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
            ? 'Charges adaptées à ma salle ✓'
            : 'Adapter les charges à ma salle'}
        </Button>

        <EquipmentOverrideSheet
          open={overrideOpen}
          exercise={exercise}
          onClose={() => setOverrideOpen(false)}
        />

        <Section label="Repos conseillé">
          <p
            className="flex justify-between text-xs text-anthracite-100"
            data-testid="catalogue-recommandations"
          >
            <span className="text-anthracite-300">Entre séries</span>
            <span className="tabular-nums">{formatRest(exercise.repos_s)}</span>
          </p>
        </Section>

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

        {/* Bouton "Supprimer cet exo" pour les customs
            uniquement. Les exos du catalogue par défaut ne sont jamais
            supprimables (ils font partie du socle, on n'a pas envie de les
            perdre). Désactivé en mode démo. */}
        {isCustom && (
          <div
            className="mt-2 border-t border-anthracite-700 pt-3"
            data-testid="catalogue-detail-custom-actions"
          >
            <p className="mb-2 text-justify text-[11px] leading-snug text-anthracite-400">
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
        title={"Supprimer cet exercice ?"}
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

      <Dialog
        open={confirmReset}
        title={"Réinitialiser ce Plafond ?"}
        description={
          <>
            Kotsh efface le{' '}
            <Concept topic="plafond">Plafond</Concept> de{' '}
            <strong>{displayName}</strong> et toutes ses mesures passées.
            À ta prochaine séance, l'app re-mesurera ta charge de départ,
            comme si tu n'avais jamais fait cet exercice.
          </>
        }
        confirmLabel="Réinitialiser"
        cancelLabel="Annuler"
        destructive
        onConfirm={async () => {
          setConfirmReset(false);
          setResetting(true);
          try {
            await engine.resetE1rm(exercise.id);
          } finally {
            setResetting(false);
          }
        }}
        onCancel={() => setConfirmReset(false)}
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
