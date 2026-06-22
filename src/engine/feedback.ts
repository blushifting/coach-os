/**
 * Mise à jour de l'e1RM par filtre exponentiel pondéré (EMA).
 *
 * Référence : recherche/03_modele_mathematique.md, §6.
 *
 * Bloc R — modèle de mesure UNIFIÉ : tous les exos sont mesurés via un plafond
 * e1RM (Epley étendu = ancre cohérente, même « faux » physiologiquement aux
 * hautes reps : les reps fixes par exo×objectif gardent le biais constant → le
 * delta reste juste). Plus de cas spécial `e1RM_app` / double progression.
 * Le filtre de fiabilité n_équiv ≤ 15 ne BLOQUE plus la progression ; on
 * distingue deux niveaux fondés sur la réserve (critère 4+, cf. Conv #34) :
 *   - ≥ 1 série « informative » (RPE > 6) → mise à jour DÉFINITIVE (snapshot).
 *   - toutes les séries « trop faciles » (RPE = 6 / 4+) → mise à jour PROVISOIRE
 *     (ratchet vers le haut, pas de snapshot — l'exo reste en calibration).
 */

import type { Exercise, SetFeedback, UserState } from './models';
import {
  EPLEY_K,
  e1rmObserved,
  effectiveLoadForE1rm,
  nEquiv,
} from './prescription';

/**
 * RPE plancher = réserve maximale informative (4 reps en réserve, libellé « 4+ »
 * côté UI). Une séance dont TOUTES les séries fiables sont à ce plancher est
 * « trop facile » : signal sans ambiguïté que l'user est plus fort que la
 * prescription. On réagit en montant le plafond décisivement (cf. update e1RM).
 */
export const RPE_RESERVE_FLOOR = 6;

/**
 * Bloc L — tolérance de reps sous la cible pour valider une charge volontairement
 * plus lourde que la prescription comme nouveau point de calibration. Si l'user
 * met plus lourd que préconisé et reste à ≤ 2 reps sous la cible, c'est un signal
 * de force fiable (≈ résolution du RPE/Epley ; la mesure passe déjà le filtre
 * `n_équiv ≤ 15`) : on adopte la charge décisivement au lieu d'amortir via l'EMA,
 * pour ne pas « rétrograder » involontairement la charge à la séance suivante.
 */
export const LOAD_OVERRIDE_REP_TOLERANCE = 2;

// =============================================================================
// 1. Coefficient α du filtre EMA (cf. §6.2)
// =============================================================================

/**
 * α dépend de la confiance dans la mesure (proximité du 1RM). Bloc R — plancher
 * à 0,1 au-delà de n_équiv 15 (avant : 0 = figé) : une série informative haute-rep
 * (endurance) doit quand même faire bouger l'ancre, juste plus doucement.
 */
export function computeAlpha(reps: number, rpe: number): number {
  const ne = nEquiv(reps, rpe);
  if (ne <= 5) return 0.3;
  if (ne <= 10) return 0.2;
  return 0.1;
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
 * Moyenne pondérée des e1RM observés d'un ensemble de séries.
 * Poids = `1/(1 + n_équiv/10)` — les séries plus proches du 1RM pèsent plus
 * (Bloc R : plus de filtre de fiabilité dur, le poids downweight les séries
 * longues sans jamais les annuler → Epley étendu).
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

  /**
   * Bloc L — charge et reps préconisées pour cet exo à cette séance (issues du
   * `SessionPlan`). Sert à détecter que l'user a soulevé plus lourd que prévu :
   * dans ce cas (et si l'écart de reps est dans la tolérance), on adopte la
   * charge décisivement plutôt que de l'amortir via l'EMA (cf.
   * `LOAD_OVERRIDE_REP_TOLERANCE`). Absent → comportement EMA standard.
   */
  readonly prescribed?: { readonly load_kg: number; readonly target_reps: number };
}

/**
 * Résultat d'une mise à jour d'e1RM pour un exo (Bloc R).
 *  - `definitive === true` : au moins une série « informative » (RPE > 4+) →
 *    mesure fiable, un snapshot daté sera créé (confidence → 'measured', l'exo
 *    compte au bilan).
 *  - `definitive === false` : mise à jour PROVISOIRE (toutes les séries à 4+) →
 *    `state.e1rm` est remonté (ratchet) SANS snapshot. L'exo reste en
 *    calibration, on évite juste de redémarrer au même point la fois suivante.
 */
export interface E1rmUpdate {
  readonly old: number;
  readonly next: number;
  readonly definitive: boolean;
}

/**
 * Met à jour `state.e1rm[exercise.id]` à partir des séries faites sur cet exo.
 * Retourne `{ old, next, definitive }` si une mise à jour a eu lieu, sinon `null`
 * (aucune série exploitable par Epley). Modèle unifié Bloc R : cf. en-tête du module.
 */
export function updateE1rmForExercise(
  state: UserState,
  exercise: Exercise,
  feedbacks: readonly SetFeedback[],
  k: number = EPLEY_K,
  options: UpdateE1rmOptions = {},
): E1rmUpdate | null {
  // Toutes les séries exploitables par Epley (reps > 0, RPE dans la plage).
  // Plus de filtre n_équiv ≤ 15 : `measurementWeight` downweight les séries
  // longues, le calcul reste défini (Epley étendu).
  const valid = feedbacks.filter(
    (f) => f.reps_done > 0 && f.rpe_perceived >= 0.5 && f.rpe_perceived <= 10,
  );
  if (valid.length === 0) {
    return null;
  }

  // Niveau de la MAJ : ≥ 1 série informative (RPE > 4+) → définitive (agrégée sur
  // les seules informatives) ; sinon tout-4+ → provisoire (agrégée sur le facile).
  const informative = valid.filter((f) => f.rpe_perceived > RPE_RESERVE_FLOOR);
  const definitive = informative.length > 0;
  const measureSets = definitive ? informative : valid;

  // Agrégation pondérée des e1RM observés (en charge totale).
  const bw = state.profile.bodyweight_kg;
  const weights = measureSets.map((f) => measurementWeight(f.reps_done, f.rpe_perceived));
  const e1rmsObs = measureSets.map((f) =>
    e1rmObserved(effectiveLoadForE1rm(f.load_kg, exercise, bw), f.reps_done, f.rpe_perceived, k),
  );
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const e1rmAgg = weights.reduce((acc, w, i) => acc + w * e1rmsObs[i]!, 0) / sumWeights;

  // Bootstrap si vide : on pose old = e1rmAgg.
  const old = state.e1rm[exercise.id] ?? e1rmAgg;

  let next: number;
  if (!definitive) {
    // Provisoire (tout en 4+) : ratchet vers le haut uniquement — on ne baisse
    // jamais le plafond sur une séance non concluante. Pas de snapshot.
    next = Math.max(old, e1rmAgg);
  } else if (options.skipEma) {
    // 1re séance calibrée : adopter e1rmAgg sans EMA (l'ancien plafond n'était
    // qu'un bootstrap heuristique).
    next = e1rmAgg;
  } else {
    // α basé sur la série informative la plus fiable (n_équiv le plus petit).
    let best = informative[0]!;
    let bestNe = nEquiv(best.reps_done, best.rpe_perceived);
    for (const f of informative) {
      const ne = nEquiv(f.reps_done, f.rpe_perceived);
      if (ne < bestNe) {
        bestNe = ne;
        best = f;
      }
    }
    const alpha = computeAlpha(best.reps_done, best.rpe_perceived);
    // Bloc L — charge volontairement > préconisée à ≤ tolérance reps sous la
    // cible : adoption décisive (max, pas d'EMA) pour ne pas rétrograder la
    // charge à la séance suivante.
    const outperformedLoad =
      options.prescribed != null &&
      best.load_kg > options.prescribed.load_kg &&
      best.reps_done >= options.prescribed.target_reps - LOAD_OVERRIDE_REP_TOLERANCE;
    next = outperformedLoad
      ? Math.max(old, e1rmAgg)
      : alpha * e1rmAgg + (1 - alpha) * old;
  }

  state.e1rm[exercise.id] = next;
  return { old, next, definitive };
}
