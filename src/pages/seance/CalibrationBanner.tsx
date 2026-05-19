/**
 * Banner de calibration affiché au-dessus des séries d'un exo en séance
 * (Conv #12b). Apparaît si la confidence est `'not_calibrated'` ou `'stale'`.
 *
 * - `'not_calibrated'` : l'exo n'a jamais été mesuré → texte pédagogique
 *   "On apprend ta charge — vise 3-6 reps avec 2-3 reps en réserve".
 *   Lien discret "Je connais déjà mon plafond" → ouvre `ManualE1rmSheet`.
 * - `'stale'` : dernière mesure > 8 sem → texte plus court invitant à
 *   refaire une vraie série. Pas de sheet manuelle ici (la mesure se fait
 *   naturellement en série).
 *
 * Live feedback : si l'utilisateur a déjà coché ≥1 série fiable de cet exo
 * pendant la séance en cours, on affiche "Plafond appris : X kg" calculé via
 * `e1rmObserved` (max des séries fiables). Permet de voir tout de suite que
 * l'app a compris la charge — UX clé du remplacement de Séance 0.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import {
  effectiveLoadForE1rm,
  e1rmObserved,
  measurementIsReliable,
} from '@/engine/prescription';
import type { Exercise } from '@/engine/models';
import type { SetEntry } from '@/lib/session-runner';
import type { E1rmConfidence } from '@/lib/calibration-status';
import { ManualE1rmSheet } from './ManualE1rmSheet';

interface CalibrationBannerProps {
  readonly exercise: Exercise;
  readonly bodyweightKg: number;
  readonly confidence: E1rmConfidence;
  readonly entries: ReadonlyArray<SetEntry>;
}

function computeLiveE1rm(
  exercise: Exercise,
  bodyweightKg: number,
  entries: ReadonlyArray<SetEntry>,
): number | null {
  let best: number | null = null;
  for (const e of entries) {
    if (!e.done) continue;
    if (e.reps === null || e.reps <= 0) continue;
    if (e.load_kg === null) continue;
    if (!measurementIsReliable(e.reps, e.rpe)) continue;
    try {
      const total = effectiveLoadForE1rm(e.load_kg, exercise, bodyweightKg);
      const v = e1rmObserved(total, e.reps, e.rpe);
      if (best === null || v > best) best = v;
    } catch {
      // RPE/reps hors plage Epley : on ignore
    }
  }
  return best;
}

export function CalibrationBanner({
  exercise,
  bodyweightKg,
  confidence,
  entries,
}: CalibrationBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const liveE1rm = useMemo(
    () => computeLiveE1rm(exercise, bodyweightKg, entries),
    [exercise, bodyweightKg, entries],
  );

  if (confidence === 'measured') return null;

  const isStale = confidence === 'stale';
  const learnedText =
    liveE1rm !== null
      ? `Plafond appris : ${liveE1rm.toFixed(1)} kg — ajuste les séries suivantes si besoin.`
      : null;

  return (
    <>
      <div
        data-testid={`calibration-banner-${exercise.id}`}
        data-confidence={confidence}
        className="-mx-1 mb-1 flex flex-col gap-1.5 rounded-lg border border-sang-700/40 bg-sang-900/20 px-3 py-2 text-xs leading-relaxed text-anthracite-100"
      >
        {liveE1rm !== null ? (
          <p className="text-sang-200">
            <span className="font-semibold text-white">{learnedText}</span>
          </p>
        ) : (
          <p>
            <span className="font-semibold text-sang-300">
              {isStale ? 'À recalibrer' : 'On apprend ta charge'}
            </span>{' '}
            —{' '}
            {isStale
              ? 'plafond pas mesuré depuis 8 semaines, cette série le rafraîchira.'
              : 'vise 3-6 reps en gardant 2-3 reps en réserve (effort 7-8/10).'}
          </p>
        )}

        {!isStale && liveE1rm === null ? (
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
