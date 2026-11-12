/**
 * Moteur de prescription : e1RM, charge cible, RPE→%1RM, arrondi.
 *
 * Référence :
 *   - recherche/03_modele_mathematique.md, §3, §4, §8 (formules e1RM legacy)
 *   - recherche/09_programmation.md, §3, §9.2 (refacto par MuscleGoal)
 *
 * Dump 2.4, étape 4 — la charge et les reps prescrites viennent de la règle de
 * progression (`progression.ts`) ; ce module ne garde que les calculs (Plafond,
 * charge cible, arrondi, poids du corps).
 */

import type { Exercise, UserState } from './models';
import { ChargeType } from './models';

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
 * L'exo doit-il être prescrit en mode "poids du corps seulement" (charge
 * externe forcée à 0, progression en reps) ? Seuls les types bodyweight
 * (loaded / assisted) sont concernés ; pour les autres (DUMBBELL, BARBELL,
 * MACHINE…), la notion de PDC n'a pas de sens → `false`.
 *
 * Défaut (#63) : un exo LESTABLE (`bodyweight_loaded` — relevés de jambes
 * suspendus, hyperextensions, dips, tractions, pompes lestées…) se fait au
 * poids du corps tant que l'user n'a pas décidé d'ajouter du lest. L'assisté
 * garde son défaut historique (la "charge" est une assistance, pas un lest).
 * L'user peut trancher explicitement via `EquipmentOverrideSheet` (pdc_only
 * = true pour forcer le poids du corps, false pour ajouter du lest) ; ce choix
 * explicite prime toujours sur le défaut.
 */
export function effectivePdcOnly(state: UserState, exercise: Exercise): boolean {
  if (
    exercise.charge !== ChargeType.BODYWEIGHT_LOADED &&
    exercise.charge !== ChargeType.BODYWEIGHT_ASSISTED
  ) {
    return false;
  }
  const override = state.equipment_overrides[exercise.id];
  if (override?.pdc_only != null) return override.pdc_only;
  return exercise.charge === ChargeType.BODYWEIGHT_LOADED;
}

// =============================================================================
// 4. Charge effective / charge externe selon le type
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
