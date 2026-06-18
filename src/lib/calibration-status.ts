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
import { E1RMApp } from '@/engine/models';

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

// =============================================================================
// Bloc I (Conv #34) — confidence unifiée incluant les exos sans e1RM mesurable.
// =============================================================================

/**
 * Ensemble des exos déjà réalisés au moins une fois (présents dans les séries
 * d'au moins un feedback de séance passé). Sert de signal « déjà calibré » pour
 * les exos en double-progression (`e1RM_app:'non'`) qui n'auront jamais de
 * snapshot e1RM. Typé structurellement pour rester découplé de `FeedbackRow`.
 */
export function exercisesEverDone(
  feedbacks: ReadonlyArray<{ feedback: { sets: ReadonlyArray<{ exercise_id: string }> } }>,
): Set<string> {
  const out = new Set<string>();
  for (const row of feedbacks) {
    for (const s of row.feedback.sets) out.add(s.exercise_id);
  }
  return out;
}

/**
 * Confidence de calibration d'un exo, en tenant compte de son `e1RM_app`.
 *
 * Les exos `e1RM_app:'non'` (isolation en double-progression : oiseau, élévations
 * latérales, mollets, abdos…) n'obtiennent JAMAIS de snapshot e1RM
 * (`updateE1rmForExercise` ne pose pas `state.e1rm`, donc
 * `txCommitSessionFeedback` ne snapshote pas) → avec `e1rmConfidenceFor` seul ils
 * resteraient éternellement `'not_calibrated'` (bannière « on apprend ta charge »
 * à chaque séance). On les aligne sur les autres exos via l'historique des
 * feedbacks : `'measured'` dès qu'ils ont été faits une fois, sinon
 * `'not_calibrated'` (bannière de découverte unique). Pas de `'stale'` : rien à
 * recalibrer en double-progression.
 *
 * Pour `full`/`partial`, comportement strictement inchangé (délègue à
 * `e1rmConfidenceFor`, piloté par les snapshots datés).
 */
export function calibrationConfidenceFor(
  exoId: string,
  e1rmApp: E1RMApp,
  e1rm: Readonly<Record<string, number>>,
  snapshots: ReadonlyArray<Pick<E1rmSnapshotRow, 'exercise_id' | 'date'>>,
  everDoneExoIds: ReadonlySet<string>,
  today: Date = new Date(),
): E1rmConfidence {
  if (e1rmApp === E1RMApp.NON) {
    return everDoneExoIds.has(exoId) ? 'measured' : 'not_calibrated';
  }
  return e1rmConfidenceFor(exoId, e1rm, snapshots, today);
}
