/**
 * Moteur de prescription : e1RM, charge cible, RPE→%1RM, arrondi.
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
  ExType,
  MuscleObjective,
  MuscleStatus,
  objectiveToMuscleObjective,
} from './models';
import { DELOAD_WEEK_IN_CYCLE, DELOAD_LOAD_FACTOR } from './volume';

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

/**
 * Conv #20 — l'exo doit-il être prescrit en mode "poids du corps seulement" ?
 *
 * `true` si l'user a explicitement activé `pdc_only` sur cet exo via
 * EquipmentOverrideSheet ET que la charge de l'exo est de type bodyweight
 * (loaded ou assisted). Pour les autres types (DUMBBELL, BARBELL, MACHINE…),
 * le flag est ignoré : la notion de PDC n'a pas de sens.
 */
export function effectivePdcOnly(state: UserState, exercise: Exercise): boolean {
  if (
    exercise.charge !== ChargeType.BODYWEIGHT_LOADED &&
    exercise.charge !== ChargeType.BODYWEIGHT_ASSISTED
  ) {
    return false;
  }
  const override = state.equipment_overrides[exercise.id];
  return override !== undefined && override.pdc_only === true;
}

/**
 * Refonte progression — l'exo est-il piloté par le cliquet de charge
 * (`prescribed_load_floor`) ? Oui pour les exos à charge externe ADDITIVE
 * (barre, haltère, machine, lesté). Non pour le poids du corps pur, l'assisté
 * (charge = assistance, sens inverse) et le mode PDC : ils gardent la voie e1RM.
 */
export function exerciseUsesLoadFloor(state: UserState, exercise: Exercise): boolean {
  if (effectivePdcOnly(state, exercise)) return false;
  return (
    exercise.charge !== ChargeType.BODYWEIGHT &&
    exercise.charge !== ChargeType.BODYWEIGHT_ASSISTED
  );
}

/**
 * Conv #20 — Reps nécessaires pour atteindre `e1rmTotal` à `rpeTarget` quand
 * la charge externe est forcée à 0 (mode PDC). On résout Epley inverse :
 *
 *   e1rmTotal = effectiveLoad × (1 + k × (reps + 10 − rpe))
 *
 * avec `effectiveLoad` constant = bodyweight pour BODYWEIGHT_LOADED (load=0)
 * et BODYWEIGHT_ASSISTED (load=0 = pas d'assistance = bw plein). Le
 * "plafond fictif" Epley est étendu — on accepte des reps > 15 même si la
 * formule sort de sa zone fiable. Floor à 1 rep.
 */
export function targetRepsForPdc(
  e1rmTotal: number,
  bodyweight: number,
  rpeTarget: number,
  k: number = EPLEY_K,
): number {
  if (bodyweight <= 0) {
    return 1;
  }
  const ratio = e1rmTotal / bodyweight;
  if (ratio <= 1) {
    return 1;
  }
  const nEq = (ratio - 1) / k;
  const reps = nEq - (10 - rpeTarget);
  return Math.max(1, Math.round(reps));
}

// =============================================================================
// 4. Reps cibles, repos, RPE par phase — voie legacy (Profile.objective)
// =============================================================================

// Reps cibles FIXES par objectif × type d'exo (Conv #29 — décision Azur).
//
// Une valeur RONDE, facile à suivre en salle, dans la partie HAUTE de la
// fourchette classique (plus de reps = plus de volume/stimulus), mais
// PLAFONNÉE pour rester exploitable par Epley : on veut garder
//   n_équiv = reps + (10 − RPE) ≤ 15   (cf. `measurementIsReliable`),
// soit reps ≲ 12 aux RPE de travail (7-9). Au-delà, l'e1RM dérivé est trop
// bruité pour recalibrer.
//
//   - FORCE : volontairement BAS (spécificité force, charges lourdes) ;
//     Epley très fiable. On ne « monte » donc PAS en haut de fourchette ici.
//   - HYPERTROPHIE : 10 (poly) / 12 (iso) — haut de fourchette, rond, Epley OK.
//   - ENDURANCE : haut assumé, hors zone Epley fiable (le recalibrage e1RM est
//     de toute façon filtré par `measurementIsReliable` — attendu pour ce public).
//   - MAINTIEN : modéré, dans la zone Epley fiable → lecture de progrès propre.
const TARGET_REPS: Record<MuscleObjective, { compound: number; isolation: number }> = {
  [MuscleObjective.FORCE]: { compound: 5, isolation: 8 },
  [MuscleObjective.HYPERTROPHIE]: { compound: 10, isolation: 12 },
  [MuscleObjective.ENDURANCE]: { compound: 15, isolation: 20 },
  [MuscleObjective.MAINTIEN]: { compound: 8, isolation: 10 },
};

/** Reps cibles fixes pour cet objectif de muscle et ce type d'exo. */
export function fixedReps(objective: MuscleObjective, exType: ExType): number {
  const t = TARGET_REPS[objective];
  return exType === ExType.ISOLATION ? t.isolation : t.compound;
}

/** Reps cibles pour cet exo (voie legacy : Profile.objective global). */
export function targetReps(profile: Profile, exercise: Exercise): number {
  return fixedReps(objectiveToMuscleObjective(profile.objective), exercise.type);
}

// Refonte progression — plus de rampe RPE intra-cycle (reliquat de la montée de
// volume Israetel, virée Bloc L). Un RPE de RÉFÉRENCE constant par objectif sert
// seulement à SEED la charge (le cliquet `prescribed_load_floor` prend ensuite le
// relais) ; le déload (sem 5) abaisse le RPE. (Voie legacy Profile.objective.)
const BASE_RPE_LEGACY: Record<Objective, number> = {
  [Objective.HYPERTROPHIE]: 7.0,
  [Objective.FORCE]: 7.0,
  [Objective.ENDURANCE]: 7.0,
};

/** RPE de référence (constant, déload mis à part) pour cette semaine (voie legacy). */
export function targetRpe(objective: Objective, weekInCycle: number): number {
  if (!(weekInCycle >= 1 && weekInCycle <= 5)) {
    throw new Error(`Semaine hors plage 1..5 : ${weekInCycle}`);
  }
  return weekInCycle === DELOAD_WEEK_IN_CYCLE ? DELOAD_RPE : BASE_RPE_LEGACY[objective];
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

// Refonte progression — plus de courbe RPE intra-cycle. Un RPE de RÉFÉRENCE
// constant par objectif (= ex-base de semaine 1) sert à SEED la charge.
const BASE_RPE: Record<MuscleObjective, number> = {
  [MuscleObjective.FORCE]: 7.0,
  [MuscleObjective.HYPERTROPHIE]: 7.0,
  [MuscleObjective.ENDURANCE]: 8.0,
  [MuscleObjective.MAINTIEN]: 6.0,
};
export const DELOAD_RPE = 6.0;
export const RECOVERY_RPE_CAP = 7.0; // cf. 09 §8.6

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

/** RPE de référence (constant, déload mis à part) pour cet objectif et cette semaine. */
function baseRpeFromMuscleObjective(objective: MuscleObjective, week: number): number {
  if (!(week >= 1 && week <= 5)) {
    throw new Error(`Semaine hors plage 1..5 : ${week}`);
  }
  if (week === DELOAD_WEEK_IN_CYCLE) {
    return DELOAD_RPE;
  }
  return BASE_RPE[objective];
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
 * Reps cibles pour cet exo (valeur fixe selon l'objectif du muscle primaire).
 * Si aucun muscle primaire n'est dans muscle_goals → fallback Hypertrophie.
 */
export function targetRepsForExercise(
  exercise: Exercise,
  muscleGoals: Record<string, MuscleGoal>,
): number {
  const goal = primaryMuscleGoal(exercise, muscleGoals);
  const objective = goal ? goal.objective : MuscleObjective.HYPERTROPHIE;
  return fixedReps(objective, exercise.type);
}

/**
 * Reps cibles `R` pour cet exo selon la voie active (muscle_goals si un muscle
 * primaire y est, sinon legacy Profile.objective). Mutualise la sélection de voie
 * de `buildPrescription` pour le cliquet de progression (cf. feedback.ts).
 */
export function resolveTargetReps(state: UserState, exercise: Exercise): number {
  const mg = Object.keys(state.muscle_goals).length > 0 ? state.muscle_goals : null;
  if (mg !== null && primaryMuscleGoal(exercise, mg) !== null) {
    return targetRepsForExercise(exercise, mg);
  }
  return targetReps(state.profile, exercise);
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

  // Conv #20 — mode PDC sticky : charge externe forcée à 0, reps recalculés
  // pour hit le RPE cible avec le seul poids du corps. Epley étendu (n_eq
  // peut sortir de la zone fiable [≤15], on accepte la prescription quand
  // même — le but est de proposer un volume cohérent même sans charge).
  const pdcOnly = state !== null && effectivePdcOnly(state, exercise);
  let extLoad: number;
  if (pdcOnly) {
    reps = targetRepsForPdc(e1rmTotal, profile.bodyweight_kg, rpe, k);
    extLoad = 0;
  } else {
    const totalLoad = targetLoad(e1rmTotal, reps, rpe, k);
    extLoad = externalLoadFromE1rm(totalLoad, exercise, profile.bodyweight_kg);
    const inc = state !== null ? effectiveIncrement(state, exercise) : exercise.inc_kg;
    extLoad = roundToIncrement(extLoad, inc);
    // Refonte progression — cliquet de charge. La charge prescrite vient du
    // PLANCHER persisté (`prescribed_load_floor`) ; l'e1RM ci-dessus ne sert qu'à
    // SEED ce plancher la 1re fois (mute `state`, comme le reste du moteur). Exos
    // sans charge externe additive exclus. Déload : plancher allégé d'un facteur.
    if (state !== null && exerciseUsesLoadFloor(state, exercise)) {
      const floor = state.prescribed_load_floor[exercise.id];
      if (weekInCycle === DELOAD_WEEK_IN_CYCLE) {
        if (floor !== undefined) {
          extLoad = roundToIncrement(floor * DELOAD_LOAD_FACTOR, inc);
        }
      } else if (floor !== undefined) {
        extLoad = floor;
      } else {
        state.prescribed_load_floor[exercise.id] = extLoad;
      }
    }
  }
  const rest = targetRest(exercise, profile.objective);

  return {
    exercise_id: exercise.id,
    reps,
    load_kg: extLoad,
    rpe_target: rpe,
    rest_s: rest,
  };
}
