/**
 * Modèle de volume Israetel simplifié, détection de plateau et déload.
 * Port 1:1 de prototype/coach_os/volume.py.
 *
 * Référence :
 *   - recherche/03_modele_mathematique.md, §5, §7, §8.1 (legacy)
 *   - recherche/09_programmation.md, §3.3, §4.5, §5.1 (extension par MuscleGoal)
 */

import type {
  Profile,
  UserState,
  SessionFeedback,
  Muscle,
} from './models';
import { Sex, Level, MuscleObjective, MuscleStatus } from './models';

// =============================================================================
// 1. V_min par muscle, niveau (cf. 03_§8.1)
// =============================================================================

export const V_MIN_BASE: Readonly<Record<string, Record<Level, number>>> = {
  pectoraux: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  dos_largeur: { [Level.DEBUTANT]: 10, [Level.INTERMEDIAIRE]: 12, [Level.AVANCE]: 14 },
  dos_epaisseur: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  trapezes_hauts: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
  quadriceps: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  ischios: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  fessiers: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  mollets: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  deltos_lateraux: { [Level.DEBUTANT]: 8, [Level.INTERMEDIAIRE]: 10, [Level.AVANCE]: 12 },
  deltos_posterieurs: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  biceps: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  triceps: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  abdos: { [Level.DEBUTANT]: 6, [Level.INTERMEDIAIRE]: 8, [Level.AVANCE]: 10 },
  obliques: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
  lombaires: { [Level.DEBUTANT]: 4, [Level.INTERMEDIAIRE]: 6, [Level.AVANCE]: 8 },
};

export const FEMALE_BONUS_MUSCLES: ReadonlySet<string> = new Set([
  'pectoraux',
  'dos_largeur',
  'dos_epaisseur',
  'deltos_lateraux',
  'deltos_posterieurs',
  'biceps',
  'triceps',
]);
export const FEMALE_BONUS_FACTOR = 1.15;

export const SENIOR_AGE_THRESHOLD = 50;
export const SENIOR_FACTOR = 0.8;
export const SENIOR_VMAX_FACTOR = 1.5;

export const DEFAULT_VMAX_FACTOR = 1.8;
export const DELTA_V_PER_WEEK = 2;
export const DELOAD_FACTOR = 0.5;
/**
 * Conv #21bis — Semaine du cycle dédiée au déload (5/5 par convention).
 * Dupliqué côté `lib/dashboard.ts` (`DELOAD_WEEK_INDEX`) mais le moteur
 * reste pur (pas d'import depuis lib/). Toute relecture doit se baser
 * sur cette constante plutôt qu'un `=== 5` magique.
 */
export const DELOAD_WEEK_IN_CYCLE = 5;

export const VMAX_UP_DELTA = 2;
export const VMAX_DOWN_DELTA = 2;

// =============================================================================
// 2. Facteurs de volume par MuscleObjective (cf. 09 §3.3)
// =============================================================================

export const OBJECTIVE_VOLUME_FACTOR: Record<MuscleObjective, number> = {
  [MuscleObjective.FORCE]: 0.7,
  [MuscleObjective.HYPERTROPHIE]: 1.0,
  [MuscleObjective.ENDURANCE]: 1.25,
  [MuscleObjective.MAINTIEN]: 0.4,
};

// Cf. 09 §5.1 — rendement décroissant >5-6 séries/exo (Schoenfeld 2017).
export const SETS_PER_SESSION_OPTIMAL = 5;
export const MAX_SETS_PER_SESSION_PER_MUSCLE = 10;

// Volume "maintenance" : 2 séries minimum, sinon 40 % de V_min (Bickel 2011).
export const MAINTENANCE_MIN_SETS = 2.0;

// =============================================================================
// 3. Initialisation des bornes
// =============================================================================

/** Retourne `[V_min, V_max]` par muscle pour ce profil. */
export function initialVolumeBounds(
  profile: Profile,
): readonly [Record<string, number>, Record<string, number>] {
  const vMin: Record<string, number> = {};
  const vMax: Record<string, number> = {};
  for (const [muscle, byLevel] of Object.entries(V_MIN_BASE)) {
    let base = byLevel[profile.level];
    if (profile.sex === Sex.FEMME && FEMALE_BONUS_MUSCLES.has(muscle)) {
      base *= FEMALE_BONUS_FACTOR;
    }
    if (profile.age >= SENIOR_AGE_THRESHOLD) {
      base *= SENIOR_FACTOR;
    }
    vMin[muscle] = base;
    if (profile.age >= SENIOR_AGE_THRESHOLD) {
      vMax[muscle] = base * SENIOR_VMAX_FACTOR;
    } else {
      vMax[muscle] = base * DEFAULT_VMAX_FACTOR;
    }
  }
  return [vMin, vMax];
}

// =============================================================================
// 4. Volume cible pour la semaine courante (legacy, cf. 03_§5.1)
// =============================================================================

/** Volume cible (séries pondérées) pour ce muscle cette semaine. Voie legacy. */
export function targetVolume(state: UserState, muscle: string): number {
  const w = state.current_week_in_cycle;
  const vMin = state.volume_min[muscle]!;
  const vMax = state.volume_max[muscle]!;
  if (w === 5) {
    return vMin * DELOAD_FACTOR;
  }
  const target = vMin + (w - 1) * DELTA_V_PER_WEEK;
  return Math.min(target, vMax);
}

// =============================================================================
// 5. Voie muscle_goals : effectiveVolumeBounds + targetFrequency (cf. 09 §4.5)
// =============================================================================

/**
 * V_min/V_max effectifs pour ce muscle, pondérés par MuscleGoal.
 *   - NON_COUVERT ou absent → (0, 0)
 *   - SUGGERE → (V_maintien, V_maintien) — fixe, pas de progression hebdo
 *   - PRIORITAIRE → (base_min × factor, base_max × factor) selon objectif
 */
export function effectiveVolumeBounds(
  state: UserState,
  muscle: string,
): readonly [number, number] {
  if (!(muscle in state.volume_min)) {
    return [0, 0];
  }
  const baseMin = state.volume_min[muscle]!;
  const baseMax = state.volume_max[muscle]!;
  const goal = state.muscle_goals[muscle];

  if (!goal || goal.status === MuscleStatus.NON_COUVERT) {
    return [0, 0];
  }
  if (goal.status === MuscleStatus.SUGGERE) {
    const v = Math.max(
      MAINTENANCE_MIN_SETS,
      baseMin * OBJECTIVE_VOLUME_FACTOR[MuscleObjective.MAINTIEN],
    );
    return [v, v];
  }
  // PRIORITAIRE
  const factor = OBJECTIVE_VOLUME_FACTOR[goal.objective];
  return [baseMin * factor, baseMax * factor];
}

/**
 * Fréquence hebdo cible pour ce muscle (cf. 09 §5.1).
 * freq = ceil(V_cible / SETS_PER_SESSION_OPTIMAL), capée à sessions_per_week.
 */
export function targetFrequency(muscle: string, state: UserState): number {
  const [vMin] = effectiveVolumeBounds(state, muscle);
  if (vMin <= 0) {
    return 0;
  }
  const freq = Math.max(1, Math.ceil(vMin / SETS_PER_SESSION_OPTIMAL));
  return Math.min(freq, state.profile.sessions_per_week);
}

// =============================================================================
// 6. Décompte des séries effectivement réalisées
// =============================================================================

/**
 * Compte le volume hebdo réalisé pour chaque muscle, agrégé sur les N
 * dernières (cycle_index, week_in_cycle) distincts.
 */
export function countWeeklyVolume(
  history: readonly SessionFeedback[],
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
  weeks = 1,
): Record<string, number> {
  if (history.length === 0) {
    return {};
  }
  const keysSeen: Array<readonly [number, number]> = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i]!;
    const k: readonly [number, number] = [s.cycle_index, s.week_in_cycle];
    if (!keysSeen.some((x) => x[0] === k[0] && x[1] === k[1])) {
      keysSeen.push(k);
    }
    if (keysSeen.length >= weeks) {
      break;
    }
  }
  const inSet = (k0: number, k1: number) =>
    keysSeen.some((x) => x[0] === k0 && x[1] === k1);

  const volumes: Record<string, number> = {};
  for (const s of history) {
    if (!inSet(s.cycle_index, s.week_in_cycle)) continue;
    for (const f of s.sets) {
      const mus = musclesOf[f.exercise_id] ?? {};
      for (const [m, coef] of Object.entries(mus)) {
        volumes[m] = (volumes[m] ?? 0) + coef;
      }
    }
  }
  return volumes;
}

// =============================================================================
// 7. Détection de plateau (cf. 03_§7.1)
// =============================================================================

/**
 * Indice de force agrégée pour un muscle = moyenne pondérée des e1RM des
 * exos qui ont ce muscle en primaire (coef ≥ 1.0).
 */
export function aggregateForceIndex(
  state: UserState,
  muscle: string,
  musclesOf: Readonly<Record<string, Readonly<Record<string, number>>>>,
): number {
  const e1rms: number[] = [];
  const weights: number[] = [];
  for (const [exId, e1rm] of Object.entries(state.e1rm)) {
    const coef = musclesOf[exId]?.[muscle] ?? 0;
    if (coef >= 1.0) {
      e1rms.push(e1rm);
      weights.push(coef);
    }
  }
  if (e1rms.length === 0) {
    return 0;
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  return e1rms.reduce((acc, e, i) => acc + e * weights[i]!, 0) / sumW;
}

/**
 * Plateau détecté si pendant 2 semaines consécutives :
 * Δ(indice force) ≤ deltaThreshold ET RPE moyen ≥ RPE cible + 0.5.
 */
export function isPlateau(
  weekSummaryCurrent: Readonly<Record<string, number>>,
  weekSummaryPrevious: Readonly<Record<string, number>> | null,
  muscle: string,
  rpeTarget: number,
  rpeMeanCurrent: number,
  rpeMeanPrevious: number | null,
  deltaThreshold = 0.0,
  rpeOvershoot = 0.5,
): boolean {
  if (weekSummaryPrevious === null || rpeMeanPrevious === null) {
    return false;
  }
  const fc = weekSummaryCurrent[muscle] ?? 0;
  const fp = weekSummaryPrevious[muscle] ?? 0;
  const deltaNow = fc - fp;
  const rpeHighNow = rpeMeanCurrent >= rpeTarget + rpeOvershoot;
  const rpeHighPrev = rpeMeanPrevious >= rpeTarget + rpeOvershoot;
  return deltaNow <= deltaThreshold && rpeHighNow && rpeHighPrev;
}

// =============================================================================
// 8. Avancement hebdomadaire et déload
// =============================================================================

/** Décide la semaine suivante. Renvoie un libellé d'événement. */
export function advanceWeek(
  state: UserState,
  plateauDetected = false,
  hitVMaxWithoutPlateau: Record<string, boolean> | null = null,
): string {
  const w = state.current_week_in_cycle;
  let event = '';
  if (w === 5) {
    state.cycle_index += 1;
    state.current_week_in_cycle = 1;
    if (hitVMaxWithoutPlateau) {
      for (const [muscle, ok] of Object.entries(hitVMaxWithoutPlateau)) {
        if (ok) {
          state.volume_max[muscle] = (state.volume_max[muscle] ?? 0) + VMAX_UP_DELTA;
        }
      }
    }
    event = 'fin_deload_nouveau_cycle';
  } else if (plateauDetected || w === 4) {
    if (plateauDetected) {
      for (const [muscle, count] of Object.entries(state.plateau_counter)) {
        if (count >= 2) {
          state.volume_max[muscle] = Math.max(
            state.volume_min[muscle] ?? 0,
            (state.volume_max[muscle] ?? 0) - VMAX_DOWN_DELTA,
          );
          state.plateau_counter[muscle] = 0;
        }
      }
      event = 'deload_anticipe_plateau';
    } else {
      event = 'deload_fin_de_cycle';
    }
    state.current_week_in_cycle = 5;
  } else {
    state.current_week_in_cycle = w + 1;
    event = `semaine_suivante_${state.current_week_in_cycle}`;
  }
  return event;
}

// Re-export pour parité d'API avec le module Python (Muscle est dans models).
export type { Muscle };
