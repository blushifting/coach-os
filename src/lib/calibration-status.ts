/**
 * Confidence dérivée d'un plafond e1RM — Conv #12b.
 *
 * Depuis le retrait de la Séance 0, la calibration est transparente :
 *   - Si un exo n'a pas encore été mesuré via une vraie série RPE-exploitable,
 *     son e1rm dans `state.e1rm[exoId]` est soit absent, soit issu du
 *     bootstrap bw-based (`bootstrapE1rmIfMissing` dans `engine/engine.ts`).
 *     Dans ce cas → `'not_calibrated'`. L'UI affiche un banner d'apprentissage.
 *   - Si une mesure réelle a été faite → un snapshot daté est inséré dans
 *     `e1rmSnapshots` par `txCommitSessionFeedback`. Tant que le snapshot le
 *     plus récent est < `STALE_WEEKS` semaines → `'measured'`.
 *   - Au-delà → `'stale'`. L'UI propose une recalibration douce.
 *
 * Source de vérité du measured_at = `e1rmSnapshots.date` (pas de champ dédié
 * dans userState — la table relationnelle suffit).
 */

import type { E1rmSnapshotRow } from '@/db/schema';

export const STALE_WEEKS = 8;
export const STALE_DAYS = STALE_WEEKS * 7;

export type E1rmConfidence = 'not_calibrated' | 'measured' | 'stale';

/**
 * Renvoie la date `YYYY-MM-DD` du snapshot le plus récent pour `exoId`,
 * ou `null` si aucun snapshot n'existe.
 */
export function lastSnapshotDateFor(
  exoId: string,
  snapshots: ReadonlyArray<Pick<E1rmSnapshotRow, 'exercise_id' | 'date'>>,
): string | null {
  let best: string | null = null;
  for (const s of snapshots) {
    if (s.exercise_id !== exoId) continue;
    if (best === null || s.date > best) best = s.date;
  }
  return best;
}

/**
 * Nb de jours calendaires écoulés entre `dateKey` (YYYY-MM-DD) et `today`.
 * Utilise `Date.UTC` pour éviter les sauts d'1h sur les bascules DST (mars/oct
 * en Europe) qui fausseraient `Math.floor(diffMs / 86400000)` aux frontières.
 */
function daysSince(dateKey: string, today: Date): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const pastUtc = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((todayUtc - pastUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Confidence dérivée pour un exo donné.
 *
 * @param exoId       id de l'exercice
 * @param e1rm        `state.e1rm` (Record exoId → kg)
 * @param snapshots   liste plate de tous les snapshots (filtré par exoId à l'intérieur)
 * @param today       date courante (injectable pour les tests)
 */
export function e1rmConfidenceFor(
  exoId: string,
  e1rm: Readonly<Record<string, number>>,
  snapshots: ReadonlyArray<Pick<E1rmSnapshotRow, 'exercise_id' | 'date'>>,
  today: Date = new Date(),
): E1rmConfidence {
  const lastDate = lastSnapshotDateFor(exoId, snapshots);
  if (lastDate === null) {
    // Pas de snapshot : soit e1rm absent, soit bootstrap bw-based.
    // Dans les deux cas, pas de mesure réelle → on appelle ça "not_calibrated".
    // On ignore volontairement `e1rm[exoId]` ici : sa présence/absence ne
    // change pas l'UX (banner = "on apprend ta charge").
    void e1rm;
    return 'not_calibrated';
  }
  if (daysSince(lastDate, today) >= STALE_DAYS) {
    return 'stale';
  }
  return 'measured';
}

/** Helper : `true` si l'exo n'a jamais été mesuré (banner d'apprentissage). */
export function isNotCalibrated(
  exoId: string,
  snapshots: ReadonlyArray<Pick<E1rmSnapshotRow, 'exercise_id' | 'date'>>,
): boolean {
  return lastSnapshotDateFor(exoId, snapshots) === null;
}

/** Helper : `true` si la dernière mesure date de ≥ `STALE_WEEKS` semaines. */
export function isStale(
  exoId: string,
  snapshots: ReadonlyArray<Pick<E1rmSnapshotRow, 'exercise_id' | 'date'>>,
  today: Date = new Date(),
): boolean {
  const lastDate = lastSnapshotDateFor(exoId, snapshots);
  if (lastDate === null) return false;
  return daysSince(lastDate, today) >= STALE_DAYS;
}
