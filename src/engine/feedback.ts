/**
 * Mise à jour de l'e1RM par filtre exponentiel pondéré (EMA).
 * Port 1:1 de prototype/coach_os/feedback.py.
 *
 * Référence : recherche/03_modele_mathematique.md, §6.
 * Une mesure trop longue (n_équiv > 15) est ignorée.
 */

import type { Exercise, SetFeedback, UserState } from './models';
import { E1RMApp } from './models';
import {
  EPLEY_K,
  e1rmObserved,
  effectiveLoadForE1rm,
  measurementIsReliable,
  nEquiv,
} from './prescription';

/**
 * RPE plancher = réserve maximale informative (4 reps en réserve, libellé « 4+ »
 * côté UI). Une séance dont TOUTES les séries fiables sont à ce plancher est
 * « trop facile » : signal sans ambiguïté que l'user est plus fort que la
 * prescription. On réagit en montant le plafond décisivement (cf. update e1RM).
 */
export const RPE_RESERVE_FLOOR = 6;

// =============================================================================
// 1. Coefficient α du filtre EMA (cf. §6.2)
// =============================================================================

/** α dépend de la confiance dans la mesure (proximité du 1RM). */
export function computeAlpha(reps: number, rpe: number): number {
  const ne = nEquiv(reps, rpe);
  if (ne <= 5) return 0.3;
  if (ne <= 10) return 0.2;
  if (ne <= 15) return 0.1;
  return 0.0; // mesure non utilisée
}

/** Poids d'une mesure pour l'agrégation multi-séries (§6.4) : w = 1 / (1 + n_équiv/10). */
export function measurementWeight(reps: number, rpe: number): number {
  const ne = nEquiv(reps, rpe);
  return 1.0 / (1 + ne / 10);
}

// =============================================================================
// 2. Agrégation pondérée des e1RM observés (réutilisable côté UI)
// =============================================================================

export interface ReliableSetForE1rm {
  readonly load_kg: number;
  readonly reps: number;
  readonly rpe: number;
}

/**
 * Moyenne pondérée des e1RM observés d'un ensemble de séries fiables.
 * Poids = `1/(1 + n_équiv/10)` — les séries plus proches du 1RM pèsent plus.
 * Hypothèse : tous les éléments passent `measurementIsReliable`.
 *
 * Retourne `null` si l'ensemble est vide ou si aucune série n'est exploitable
 * par Epley (RPE/reps hors plage).
 */
export function aggregateE1rmWeighted(
  sets: readonly ReliableSetForE1rm[],
  exercise: Exercise,
  bodyweightKg: number,
  k: number = EPLEY_K,
): number | null {
  if (sets.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const s of sets) {
    try {
      const total = effectiveLoadForE1rm(s.load_kg, exercise, bodyweightKg);
      const e1 = e1rmObserved(total, s.reps, s.rpe, k);
      const w = measurementWeight(s.reps, s.rpe);
      num += w * e1;
      den += w;
    } catch {
      // RPE/reps hors plage : on ignore cette série.
    }
  }
  if (den === 0) return null;
  return num / den;
}

// =============================================================================
// 3. Mise à jour de l'e1RM pour un exercice donné
// =============================================================================

export interface UpdateE1rmOptions {
  /**
   * Si `true`, on remplace l'ancien plafond par la nouvelle agrégation sans
   * appliquer le filtre EMA. À utiliser quand l'ancien plafond stocké n'est
   * qu'un bootstrap heuristique (1re séance d'un exo) : mélanger via EMA une
   * valeur agrégée fiable avec une estimation grossière pourrirait la mesure.
   *
   * Défaut : `false` (comportement EMA standard, séances ≥ 2 d'un exo).
   */
  readonly skipEma?: boolean;
}

/**
 * Met à jour `state.e1rm[exercise.id]` à partir des séries faites sur cet exo.
 * Retourne `[ancienE1rm, nouveauE1rm]` si une mise à jour a eu lieu, sinon null.
 * Pour les exos avec `e1RM_app === 'non'`, on ne calcule pas d'e1RM.
 */
export function updateE1rmForExercise(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
  k: number = EPLEY_K,
  options: UpdateE1rmOptions = {},
): readonly [number, number] | null {
  if (exercise.e1RM_app === E1RMApp.NON) {
    return null;
  }

  // Filtrer les séries fiables.
  const reliable = feedbacks.filter((f) =>
    measurementIsReliable(f.reps_done, f.rpe_perceived),
  );
  if (reliable.length === 0) {
    return null;
  }

  // Agrégation pondérée des e1RM observés (en charge totale).
  const bw = state.profile.bodyweight_kg;
  const weights = reliable.map((f) => measurementWeight(f.reps_done, f.rpe_perceived));
  const e1rmsObs = reliable.map((f) => {
    const totalLoad = effectiveLoadForE1rm(f.load_kg, exercise, bw);
    return e1rmObserved(totalLoad, f.reps_done, f.rpe_perceived, k);
  });
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const e1rmAgg =
    weights.reduce((acc, w, i) => acc + w * e1rmsObs[i]!, 0) / sumWeights;

  // 1re séance d'un exo : on prend e1rmAgg sans EMA (l'ancien plafond, s'il
  // existe, n'est qu'un bootstrap heuristique — pas une vraie mesure).
  if (options.skipEma) {
    const old = state.e1rm[exercise.id] ?? e1rmAgg;
    state.e1rm[exercise.id] = e1rmAgg;
    return [old, e1rmAgg] as const;
  }

  // α basé sur la mesure la plus fiable (n_équiv le plus petit).
  let bestIdx = 0;
  let bestNe = nEquiv(reliable[0]!.reps_done, reliable[0]!.rpe_perceived);
  for (let i = 1; i < reliable.length; i++) {
    const ne = nEquiv(reliable[i]!.reps_done, reliable[i]!.rpe_perceived);
    if (ne < bestNe) {
      bestNe = ne;
      bestIdx = i;
    }
  }
  const alpha = computeAlpha(reliable[bestIdx]!.reps_done, reliable[bestIdx]!.rpe_perceived);

  // Bootstrap si vide : on pose old = e1rmAgg.
  const old = state.e1rm[exercise.id] ?? e1rmAgg;

  // 1.17 — séance « trop facile » : toutes les séries fiables sont à la réserve
  // plancher (RPE 6 = 4+ reps en réserve). On NE damp PAS via l'EMA — le plafond
  // monte décisivement vers l'e1RM observé (borne basse conservatrice : à effort
  // faible, Epley sous-estime), pour que la séance suivante prescrive plus lourd.
  // `max(old, …)` : une séance facile ne baisse jamais le plafond.
  const tooEasy = reliable.every((f) => f.rpe_perceived <= RPE_RESERVE_FLOOR);
  const next = tooEasy
    ? Math.max(old, e1rmAgg)
    : alpha * e1rmAgg + (1 - alpha) * old;
  state.e1rm[exercise.id] = next;
  return [old, next] as const;
}

// =============================================================================
// 3. Double progression (pour e1RM_app ∈ {partial, non} sans e1RM fiable)
// =============================================================================

/**
 * Si l'utilisateur atteint le haut de la fourchette de reps sur toutes les séries,
 * on enregistre le nouveau plancher de reps. La séance suivante, on monte la charge.
 *
 * Cette logique sert pour les exos en double progression (mollets, élévations,
 * abdos, etc.) où la prescription par e1RM est imprécise.
 */
export function maybeProgressReps(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
): boolean {
  if (feedbacks.length === 0) {
    return false;
  }
  const hi = exercise.reps_hyp[1];
  const allAtTop = feedbacks.every((f) => f.reps_done >= hi);
  if (allAtTop) {
    state.reps_pr[exercise.id] = hi;
    return true;
  }
  return false;
}
