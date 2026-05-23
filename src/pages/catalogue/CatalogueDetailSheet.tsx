import { useState, type ReactNode } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import { exercisePrimaires, exerciseSynergistes } from '@/engine/models';
import type { Exercise } from '@/engine/models';
import {
  buildDescription,
  chargeLabel,
  equipLabel,
  extypeLabel,
  patternLabel,
  tagLabel,
} from '@/lib/catalog-filter';
import { muscleLabel } from '@/lib/progress';
import { formatRest } from '@/lib/session-runner';
import { useCoachOsStore } from '@/store';
import { useDemoMode } from '@/store/selectors';
import { ManualE1rmSheet } from '@/pages/seance/ManualE1rmSheet';
import { PatternIcon } from '@/pages/seance/PatternIcon';
import { EquipmentOverrideSheet } from './EquipmentOverrideSheet';

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
  const bodyweightKg = useCoachOsStore(
    (s) => s.userState?.profile.bodyweight_kg ?? 75,
  );
  const hasOverride = useCoachOsStore(
    (s) => exercise !== null && s.userState?.equipment_overrides[exercise.id] !== undefined,
  );
  const demoActive = useDemoMode();

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

  const repsRange = exercise.reps_hyp;
  const repsForce = exercise.reps_force;

  return (
    <Sheet open={open} onClose={onClose} title={exercise.nom_fr}>
      <div className="flex flex-col gap-4" data-testid="catalogue-detail-content">
        <div className="flex justify-center">
          <AnatomicalSilhouette
            highlights={highlights}
            view="both"
            className="h-56 w-auto"
            testId="catalogue-detail-silhouette"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <PatternIcon pattern={exercise.pattern} size="sm" />
          <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
            {extypeLabel(exercise.type)}
          </span>
          <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
            {patternLabel(exercise.pattern)}
          </span>
          <span className="rounded bg-anthracite-700 px-2 py-0.5 text-xs text-white">
            {chargeLabel(exercise.charge)}
          </span>
        </div>

        <p
          className="text-sm leading-relaxed text-anthracite-100"
          data-testid="catalogue-detail-description"
        >
          {buildDescription(exercise)}
        </p>

        {e1rm !== null && e1rm > 0 ? (
          <div
            data-testid="catalogue-detail-e1rm"
            className="flex items-baseline justify-between rounded-xl border border-sang-700/40 bg-sang-900/25 px-3 py-2"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-sang-300">
              Ton plafond
            </span>
            <span className="font-display text-xl tabular-nums text-white">
              {e1rm.toFixed(1)} kg
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
            ? 'Modifier mon plafond'
            : 'Je connais mon plafond'}
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
          <Section label="Synergistes">
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
            <li className="flex justify-between">
              <span className="text-anthracite-300">Difficulté</span>
              <span>{exercise.dif || '—'}</span>
            </li>
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
      </div>
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
