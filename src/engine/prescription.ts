/**
 * Moteur de prescription : e1RM, charge cible, RPE→%1RM, arrondi.
 * Port 1:1 de prototype/coach_os/prescription.py.
 *
 * Référence :
 *   - recherche/03_modele_mathematique.md, §3, §4, §8 (formules e1RM legacy)
 *   - recherche/09_programmation.md, §3, §9.2 (refacto par MuscleGoal)
 *
 * Deux voies coexistent :
 *   - Voie legacy (Profile.objective global) : `targetRpe`, `targetReps`.
 *   - Voie muscle_goals (objectif-par-muscle) : `targetRpeForExercise`,
 *     `targetRepsForExercise`.
 *
 * `buildPrescription` accepte muscle_goals optionnel : si fourni ET au moins
 * un muscle primaire de l'exo y est, on bascule sur la voie nouvelle ; sinon
 * fallback sur la voie legacy.
 */

import type {
  Exercise,
  Profile,
  MuscleGoal,
  UserState,
  SetPrescription,
} from './models';
import {
  Objective,
  ChargeType,
  E1RMApp,
  ExType,
  MuscleObjective,
  MuscleStatus,
} from './models';

// Constante d'Epley standard (LeSuer 1997, Wood 2002).
export const EPLEY_K = 0.0333;

// =============================================================================
// 1. e1RM observé à partir d'une série réalisée
// =============================================================================

/** e1RM = c × (1 + k × (reps + 10 − RPE)). */
export function e1rmObserved(
  loadKg: number,
  reps: number,
  rpe: number,
  k: number = EPLEY_K,
): number {
  if (reps <= 0) {
    throw new Error('reps doit être > 0');
  }
  if (!(rpe >= 0.5 && rpe <= 10)) {
    throw new Error(`RPE hors plage [0.5, 10] : ${rpe}`);
  }
  const nEq = reps + (10 - rpe);
  return loadKg * (1 + k * nEq);
}

/** Reps équivalent-échec = reps + (10 - RPE). */
export function nEquiv(reps: number, rpe: number): number {
  return reps + (10 - rpe);
}

/** Une mesure n_équiv > 15 est trop bruitée pour recalibrer (cf. §3.3). */
export function measurementIsReliable(reps: number, rpe: number): boolean {
  return nEquiv(reps, rpe) <= 15;
}

// =============================================================================
// 2. Charge cible pour `n` reps à RPE `r`
// =============================================================================

/** c = e1RM / (1 + k × (reps + 10 − RPE)). Sortie non arrondie. */
export function targetLoad(
  e1rm: number,
  reps: number,
  rpe: number,
  k: number = EPLEY_K,
): number {
  if (reps <= 0) {
    throw new Error('reps doit être > 0');
  }
  if (!(rpe >= 0.5 && rpe <= 10)) {
    throw new Error(`RPE hors plage [0.5, 10] : ${rpe}`);
  }
  return e1rm / (1 + k * (reps + 10 - rpe));
}

/** Pourcentage du 1RM correspondant à `reps × RPE` (cf. table Helms). */
export function percent1rm(reps: number, rpe: number, k: number = EPLEY_K): number {
  return 100.0 / (1 + k * (reps + 10 - rpe));
}

// =============================================================================
// 3. Arrondi pratique
// =============================================================================

/**
 * Arrondit au plus proche multiple de `incrementKg`. Plancher à 0.
 * Pour les charges très lourdes (≥150 kg sur barre olympique), bascule sur
 * un incrément de 5 kg si l'incrément demandé est plus petit.
 *
 * Note : Python `round()` utilise le banker's rounding (half-to-even).
 * Math.round() en JS arrondit half-up. On reproduit le comportement Python
 * avec une fonction utilitaire.
 */
export function roundToIncrement(loadKg: number, incrementKg: number): number {
  if (incrementKg <= 0) {
    return Math.max(0.0, loadKg);
  }
  let effIncrement = incrementKg;
  if (loadKg >= 150 && incrementKg < 5) {
    effIncrement = 5.0;
  }
  return Math.max(0.0, pythonRound(loadKg / effIncrement) * effIncrement);
}

/** Reproduit `round()` Python (banker's rounding, half-to-even). */
export function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Pile 0.5 → on arrondit vers le pair le plus proche
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Incrément effectif pour cet exo, en tenant compte de l'override user.
 * Si l'utilisateur a posé un EquipmentOverride avec inc_kg défini, on l'utilise.
 * Sinon, fallback sur exercise.inc_kg du catalogue.
 */
export function effectiveIncrement(state: UserState, exercise: Exercise): number {
  const override = state.equipment_overrides[exercise.id];
  if (override !== undefined && override.inc_kg !== null) {
    return override.inc_kg;
  }
  return exercise.inc_kg;
}

// =============================================================================
// 4. Reps cibles, repos, RPE par phase — voie legacy (Profile.objective)
// =============================================================================

// Reps cibles selon objectif et type d'exercice (cf. §8.4).
// Puissance retirée en V1 (cf. 09_programmation.md §3.5).
const REPS_DEFAULT: Record<Objective, Record<'compound' | 'isolation', readonly [number, number]>> = {
  [Objective.HYPERTROPHIE]: { compound: [6, 10], isolation: [10, 15] },
  [Objective.FORCE]: { compound: [3, 5], isolation: [6, 10] },
  [Objective.ENDURANCE]: { compound: [12, 20], isolation: [15, 25] },
};

/** Reps cibles pour cet exo (voie legacy : Profile.objective global). */
export function targetReps(profile: Profile, exercise: Exercise): number {
  const objDefault = REPS_DEFAULT[profile.objective][exercise.type];
  let lo: number;
  let hi: number;
  if (profile.objective === Objective.FORCE && exercise.reps_force) {
    [lo, hi] = exercise.reps_force;
  } else {
    [lo, hi] = exercise.reps_hyp;
  }
  lo = Math.max(lo, objDefault[0]);
  hi = Math.min(hi, objDefault[1]);
  if (lo > hi) {
    [lo, hi] = exercise.reps_hyp;
  }
  return Math.floor((lo + hi) / 2);
}

// Table RPE cible par semaine du cycle et objectif (legacy, cf. 03_§8.3).
const RPE_BY_PHASE: Record<Objective, Record<number, number>> = {
  [Objective.HYPERTROPHIE]: { 1: 7.0, 2: 8.0, 3: 8.5, 4: 9.0, 5: 6.0 },
  [Objective.FORCE]: { 1: 7.0, 2: 7.5, 3: 8.0, 4: 8.5, 5: 6.0 },
  [Objective.ENDURANCE]: { 1: 7.0, 2: 7.5, 3: 8.0, 4: 8.0, 5: 6.0 },
};

/** RPE cible global pour cette semaine du cycle (voie legacy). */
export function targetRpe(objective: Objective, weekInCycle: number): number {
  if (!(weekInCycle >= 1 && weekInCycle <= 5)) {
    throw new Error(`Semaine hors plage 1..5 : ${weekInCycle}`);
  }
  return RPE_BY_PHASE[objective][weekInCycle]!;
}

/** Repos en secondes. Le catalogue donne déjà une valeur, on peut la moduler. */
export function targetRest(exercise: Exercise, objective: Objective): number {
  const base = exercise.repos_s;
  if (objective === Objective.FORCE && exercise.type === ExType.COMPOUND) {
    return base + 30;
  }
  if (objective === Objective.ENDURANCE) {
    return Math.max(60, Math.trunc(base * 0.7));
  }
  return base;
}

// =============================================================================
// 5. Voie muscle_goals (cf. 09 §3.3 & §9.2)
// =============================================================================

// Hiérarchie en cas d'égalité de rang : Force > Hyp > End > Maintien.
const HIERARCHY_OBJECTIVE: readonly MuscleObjective[] = [
  MuscleObjective.FORCE,
  MuscleObjective.HYPERTROPHIE,
  MuscleObjective.ENDURANCE,
  MuscleObjective.MAINTIEN,
];

// Courbes RPE semaines 1..4 (sem 5 = déload constant). Cf. 09 §9.2.
const BASE_RPE_CURVES: Record<MuscleObjective, readonly number[]> = {
  [MuscleObjective.FORCE]: [7.0, 7.5, 8.0, 8.0],
  [MuscleObjective.HYPERTROPHIE]: [7.0, 7.5, 8.0, 9.0],
  [MuscleObjective.ENDURANCE]: [8.0, 8.0, 8.5, 9.0],
  [MuscleObjective.MAINTIEN]: [6.0, 6.0, 7.0, 7.0],
};
export const DELOAD_RPE = 6.0;
export const RECOVERY_RPE_CAP = 7.0; // cf. 09 §8.6

// Fourchettes reps : [poly/compound, isolation]. Cf. 09 §3.3.
const REPS_RANGES_MUSCLE: Record<
  MuscleObjective,
  readonly [readonly [number, number], readonly [number, number]]
> = {
  [MuscleObjective.FORCE]: [
    [3, 6],
    [5, 8],
  ],
  [MuscleObjective.HYPERTROPHIE]: [
    [6, 12],
    [8, 15],
  ],
  [MuscleObjective.ENDURANCE]: [
    [12, 20],
    [12, 25],
  ],
  [MuscleObjective.MAINTIEN]: [
    [6, 10],
    [8, 15],
  ],
};

/**
 * Retourne le MuscleGoal du muscle PRIMAIRE de plus haut rang.
 *
 * Règles (cf. 09 §3.2) :
 *   - Ne considère que les muscles avec coef ≥ 1.0 (synergistes coef 0.5 ignorés).
 *   - Exclut les NON_COUVERT.
 *   - Tri : rank ascendant (1 = plus prioritaire), puis hiérarchie objectif
 *     (Force > Hyp > End > Maintien).
 *   - Renvoie null si aucun candidat valide.
 */
export function primaryMuscleGoal(
  exercise: Exercise,
  muscleGoals: Record<string, MuscleGoal>,
): MuscleGoal | null {
  const candidates: MuscleGoal[] = [];
  for (const [muscle, coef] of Object.entries(exercise.muscles)) {
    if (coef >= 1.0 && muscle in muscleGoals) {
      const g = muscleGoals[muscle]!;
      if (g.status !== MuscleStatus.NON_COUVERT) {
        candidates.push(g);
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    if (a.priority_rank !== b.priority_rank) {
      return a.priority_rank - b.priority_rank;
    }
    return (
      HIERARCHY_OBJECTIVE.indexOf(a.objective) - HIERARCHY_OBJECTIVE.indexOf(b.objective)
    );
  });
  return candidates[0]!;
}

/** RPE de base pour cet objectif et cette semaine du cycle (1..5). */
function baseRpeFromMuscleObjective(objective: MuscleObjective, week: number): number {
  if (!(week >= 1 && week <= 5)) {
    throw new Error(`Semaine hors plage 1..5 : ${week}`);
  }
  if (week === 5) {
    return DELOAD_RPE;
  }
  return BASE_RPE_CURVES[objective][week - 1]!;
}

/**
 * RPE cible pour cet exo, dérivé de l'objectif du muscle primaire #1.
 * Si aucun muscle primaire n'est dans muscle_goals → fallback Hypertrophie.
 * Si recovery_mode → cap à RECOVERY_RPE_CAP (7.0).
 */
export function targetRpeForExercise(
  exercise: Exercise,
  weekInCycle: number,
  muscleGoals: Record<string, MuscleGoal>,
  recoveryMode = false,
): number {
  const goal = primaryMuscleGoal(exercise, muscleGoals);
  const objective = goal ? goal.objective : MuscleObjective.HYPERTROPHIE;
  const rpe = baseRpeFromMuscleObjective(objective, weekInCycle);
  if (recoveryMode) {
    return Math.min(RECOVERY_RPE_CAP, rpe);
  }
  return rpe;
}

/**
 * Reps cibles pour cet exo (médiane de la fourchette MuscleObjective).
 * Si aucun muscle primaire n'est dans muscle_goals → fallback Hypertrophie.
 */
export function targetRepsForExercise(
  exercise: Exercise,
  muscleGoals: Record<string, MuscleGoal>,
): number {
  const goal = primaryMuscleGoal(exercise, muscleGoals);
  const objective = goal ? goal.objective : MuscleObjective.HYPERTROPHIE;
  const isIso = exercise.type === ExType.ISOLATION;
  const [polyRange, isoRange] = REPS_RANGES_MUSCLE[objective];
  const [lo, hi] = isIso ? isoRange : polyRange;
  return Math.floor((lo + hi) / 2);
}

// =============================================================================
// 6. Effective load / charge externe selon le type
// =============================================================================

/**
 * Charge totale soulevée par le pratiquant, pour le calcul d'e1RM.
 * Pour les bodyweight_loaded (dips, pull-up, etc.), l'e1RM doit inclure le
 * poids du corps. Pour bodyweight_assisted, on retire l'assistance.
 */
export function effectiveLoadForE1rm(
  loadKg: number,
  exercise: Exercise,
  bodyweight: number,
): number {
  if (exercise.charge === ChargeType.BODYWEIGHT_LOADED) {
    return loadKg + bodyweight;
  }
  if (exercise.charge === ChargeType.BODYWEIGHT) {
    return bodyweight;
  }
  if (exercise.charge === ChargeType.BODYWEIGHT_ASSISTED) {
    return Math.max(0.0, bodyweight - loadKg);
  }
  return loadKg;
}

/** Inverse de effectiveLoadForE1rm : ce qu'on affiche à l'utilisateur. */
export function externalLoadFromE1rm(
  targetTotalKg: number,
  exercise: Exercise,
  bodyweight: number,
): number {
  if (exercise.charge === ChargeType.BODYWEIGHT_LOADED) {
    return Math.max(0.0, targetTotalKg - bodyweight);
  }
  if (exercise.charge === ChargeType.BODYWEIGHT) {
    return 0.0;
  }
  if (exercise.charge === ChargeType.BODYWEIGHT_ASSISTED) {
    return Math.max(0.0, bodyweight - targetTotalKg);
  }
  return targetTotalKg;
}

// =============================================================================
// 7. Construction d'une SetPrescription
// =============================================================================

export interface BuildPrescriptionOptions {
  k?: number;
  muscleGoals?: Record<string, MuscleGoal> | null;
  recoveryMode?: boolean;
  state?: UserState | null;
}

/**
 * Construit une prescription cohérente pour une série d'un exercice donné.
 *
 * Voie de calcul :
 *   - Si muscleGoals est fourni ET au moins un muscle primaire de l'exo y est :
 *     voie nouvelle (targetRpeForExercise / targetRepsForExercise).
 *   - Sinon : voie legacy (targetRpe / targetReps via profile.objective).
 *
 * Si state est fourni, l'incrément utilisé est `effectiveIncrement(state, exercise)`
 * (qui consulte equipment_overrides). Sinon, exercise.inc_kg du catalogue.
 *
 * `e1rmTotal` : e1RM exprimé en charge totale soulevée (poids du corps inclus
 *               pour les bodyweight_loaded).
 */
export function buildPrescription(
  exercise: Exercise,
  e1rmTotal: number,
  profile: Profile,
  weekInCycle: number,
  options: BuildPrescriptionOptions = {},
): SetPrescription {
  const k = options.k ?? EPLEY_K;
  const muscleGoals = options.muscleGoals ?? null;
  const recoveryMode = options.recoveryMode ?? false;
  const state = options.state ?? null;

  const useMuscleGoals =
    muscleGoals !== null && primaryMuscleGoal(exercise, muscleGoals) !== null;

  let rpe: number;
  let reps: number;
  if (useMuscleGoals) {
    rpe = targetRpeForExercise(exercise, weekInCycle, muscleGoals, recoveryMode);
    reps = targetRepsForExercise(exercise, muscleGoals);
  } else {
    rpe = targetRpe(profile.objective, weekInCycle);
    reps = targetReps(profile, exercise);
    if (recoveryMode) {
      rpe = Math.min(RECOVERY_RPE_CAP, rpe);
    }
  }

  const totalLoad = targetLoad(e1rmTotal, reps, rpe, k);
  let extLoad = externalLoadFromE1rm(totalLoad, exercise, profile.bodyweight_kg);
  const inc = state !== null ? effectiveIncrement(state, exercise) : exercise.inc_kg;
  extLoad = roundToIncrement(extLoad, inc);
  const rest = targetRest(exercise, profile.objective);

  // E1RMApp.NON / PARTIAL : on calcule quand même mais le caller peut l'ignorer.
  void E1RMApp;

  return {
    exercise_id: exercise.id,
    reps,
    load_kg: extLoad,
    rpe_target: rpe,
    rest_s: rest,
  };
}
