/**
 * Banner de calibration affiché au-dessus des séries d'un exo en séance
 * (Conv #12b, refondu Conv #16). Apparaît si la confidence est
 * `'not_calibrated'` ou `'stale'`.
 *
 * États affichés (du plus rare au plus fréquent) :
 *  - `liveE1rm !== null` : au moins une série fiable cochée. On affiche
 *    "Plafond appris : X kg" (moyenne pondérée des séries fiables, cohérent
 *    avec l'algo fin-de-séance).
 *  - Dernière série cochée non fiable (trop facile, n_équiv > 15) : message
 *    correctif + charge auto-suggérée pour la série suivante. L'user comprend
 *    pourquoi ça n'a pas calibré et a un point de départ pour la suivante.
 *  - Aucune série cochée encore : texte pédagogique appuyé sur l'importance
 *    d'aller chercher un effort 7-8/10. Lien discret "Je connais mon plafond".
 *
 * Bandeau invisible si `confidence === 'measured'` (mode normal, vue épurée).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import type { Exercise } from '@/engine/models';
import { kgUnitLabel } from '@/lib/catalog-filter';
import {
  computeLiveE1rmFromEntries,
  lastCheckedSetIsUnreliable,
  suggestNextLoadAfterUnreliable,
  type SetEntry,
} from '@/lib/session-runner';
import type { E1rmConfidence } from '@/lib/calibration-status';
import { ManualE1rmSheet } from './ManualE1rmSheet';

interface CalibrationBannerProps {
  readonly exercise: Exercise;
  readonly bodyweightKg: number;
  readonly confidence: E1rmConfidence;
  readonly entries: ReadonlyArray<SetEntry>;
}

export function CalibrationBanner({
  exercise,
  bodyweightKg,
  confidence,
  entries,
}: CalibrationBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const liveE1rm = useMemo(
    () => computeLiveE1rmFromEntries(exercise, bodyweightKg, entries),
    [exercise, bodyweightKg, entries],
  );
  const unreliable = useMemo(
    () => (liveE1rm === null ? lastCheckedSetIsUnreliable(entries) : null),
    [entries, liveE1rm],
  );
  const suggestedLoad = useMemo(() => {
    if (unreliable === null) return null;
    return suggestNextLoadAfterUnreliable({
      exercise,
      bodyweightKg,
      reps: unreliable.reps,
      rpe: unreliable.rpe,
      load_kg: unreliable.load_kg,
    });
  }, [unreliable, exercise, bodyweightKg]);

  if (confidence === 'measured') return null;

  const isStale = confidence === 'stale';
  // Conv #20 — pour DB, l'e1rm appris et la suggestion sont per-haltère.
  const unit = kgUnitLabel(exercise.charge);

  return (
    <>
      <div
        data-testid={`calibration-banner-${exercise.id}`}
        data-confidence={confidence}
        className="-mx-1 mb-1 flex flex-col gap-1.5 rounded-lg border border-sang-700/40 bg-sang-900/20 px-3 py-2 text-xs leading-relaxed text-anthracite-100"
      >
        {liveE1rm !== null ? (
          <p className="text-sang-200">
            <span className="font-semibold text-white">
              Plafond appris : {liveE1rm.toFixed(1)} {unit}
            </span>{' '}
            — les séries suivantes sont ajustées automatiquement.
          </p>
        ) : unreliable !== null ? (
          <p>
            <span className="font-semibold text-sang-300">
              Trop facile pour calibrer
            </span>{' '}
            — vise un effort 7-8/10 (2-3 reps en réserve avant l'échec).
            {suggestedLoad !== null ? (
              <>
                {' '}
                À la série suivante, essaie autour de{' '}
                <span className="font-semibold text-white">
                  {suggestedLoad} {unit}
                </span>
                .
              </>
            ) : null}
          </p>
        ) : (
          <p>
            <span className="font-semibold text-sang-300">
              {isStale ? 'À recalibrer' : 'On apprend ta charge'}
            </span>{' '}
            —{' '}
            {isStale
              ? 'plafond pas mesuré depuis 8 semaines, cette série le rafraîchira.'
              : "vise un vrai effort 7-8/10 (2-3 reps en réserve). C'est cet effort élevé qui permet à l'appli d'apprendre ton plafond — fais 3-12 reps puis renseigne reps + effort ressenti."}
          </p>
        )}

        {!isStale && liveE1rm === null && unreliable === null ? (
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              data-testid={`btn-manual-e1rm-${exercise.id}`}
              onClick={() => setSheetOpen(true)}
            >
              Je connais mon plafond
            </Button>
          </div>
        ) : null}
      </div>

      <ManualE1rmSheet
        open={sheetOpen}
        exercise={exercise}
        bodyweightKg={bodyweightKg}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
