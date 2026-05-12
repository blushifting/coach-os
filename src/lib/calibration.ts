/**
 * Helpers purs pour la Séance 0 (calibration 1RM) — Conv #4c.
 *
 * Source de vérité :
 * - `recherche/04_specifications_coach_os.md:116` — test sous-max 3-8 reps,
 *   RPE 9-10 borne max (on autorise RPE 6-10 par pas de 0.5 côté UI).
 * - `recherche/08_ux_decisions.md §94-105` — pour chaque exo : variante préférée,
 *   saisie d'un test submax (reps + charge + RPE), calcul du plafond live.
 * - `recherche/09_programmation.md §7.6` — programmes guidés : calibration sur
 *   `role=main_*` ; spec custom : "exos clés du programme" = compounds.
 */

import type { Catalog } from '@/engine/catalog';
import {
  ChargeType,
  E1RMApp,
  ExType,
  type Exercise,
  type WeeklyTemplate,
} from '@/engine/models';
import { e1rmObserved, effectiveLoadForE1rm, measurementIsReliable } from '@/engine/prescription';

// =============================================================================
// 1. Sélection des exos à calibrer
// =============================================================================

export interface CalibrationItem {
  /** Coordonnées dans le WeeklyTemplate (utilisées pour remplacer la variante). */
  readonly dayIndex: number;
  readonly slotIndex: number;
  /** id de l'exo actuellement planifié (peut être muté si l'user change de variante). */
  readonly exerciseId: string;
  /** role guidé ("main_squat") ou null en custom. */
  readonly role: string | null;
}

/**
 * Liste les exos à calibrer en Séance 0.
 *
 * Mode guidé (au moins un `planned.role` posé) : tous les `role=main_*`
 * sans e1RM connu (cf. `hasRequiredPlafonds`).
 * Mode custom (aucun `role`) : tous les compounds `e1RM_applicable` sans e1RM.
 * Dédupliqué par `exerciseId` (1 exo = 1 calibration, même s'il apparaît plusieurs jours).
 */
export function pickCalibrationExercises(
  weekly: WeeklyTemplate,
  e1rm: Readonly<Record<string, number>>,
  catalog: Catalog,
): CalibrationItem[] {
  const isGuided = weekly.days.some((d) => d.exercises.some((p) => p.role !== null));
  const items: CalibrationItem[] = [];
  const seen = new Set<string>();
  for (let di = 0; di < weekly.days.length; di++) {
    const day = weekly.days[di]!;
    for (let si = 0; si < day.exercises.length; si++) {
      const planned = day.exercises[si]!;
      if (planned.exercise_id in e1rm) continue;
      if (seen.has(planned.exercise_id)) continue;

      let include = false;
      if (isGuided) {
        include = planned.role !== null && planned.role.startsWith('main_');
      } else {
        if (!catalog.has(planned.exercise_id)) continue;
        const ex = catalog.get(planned.exercise_id);
        include = ex.type === ExType.COMPOUND && ex.e1RM_app !== E1RMApp.NON;
      }
      if (!include) continue;

      items.push({
        dayIndex: di,
        slotIndex: si,
        exerciseId: planned.exercise_id,
        role: planned.role,
      });
      seen.add(planned.exercise_id);
    }
  }
  return items;
}

// =============================================================================
// 2. Variantes alternatives (bottom sheet "Changer de variante")
// =============================================================================

/**
 * Renvoie les exos du même `groupe_substitution` que `exerciseId`, filtrés par
 * équipement de l'user, **excluant** l'exo courant. Vide = pas d'alternative.
 */
export function alternativeVariantsFor(
  exerciseId: string,
  equipment: ReadonlySet<string>,
  catalog: Catalog,
): Exercise[] {
  if (!catalog.has(exerciseId)) return [];
  const ex = catalog.get(exerciseId);
  const group = catalog.in_substitution_group(ex.subst);
  return group.filter((x) => {
    if (x.id === exerciseId) return false;
    if (x.equip.length === 0) return true;
    for (const e of x.equip) {
      if (!equipment.has(e)) return false;
    }
    return true;
  });
}

// =============================================================================
// 3. Calculs e1RM (test sous-max ou 1RM connu)
// =============================================================================

/**
 * e1RM "total" (incluant BW pour bodyweight_loaded) à partir d'un test sous-max.
 * Lance si reps/RPE hors plage acceptée par le moteur (`prescription.e1rmObserved`).
 */
export function e1rmFromSubmaxTest(
  loadKg: number,
  reps: number,
  rpe: number,
  exercise: Exercise,
  bodyweightKg: number,
): number {
  const totalLoad = effectiveLoadForE1rm(loadKg, exercise, bodyweightKg);
  return e1rmObserved(totalLoad, reps, rpe);
}

/**
 * e1RM "total" à partir d'une charge à 1 rep (1RM connu de l'utilisateur).
 * Identique à `effectiveLoadForE1rm` puisque reps=1 RPE=10 donne n_eq=1 et
 * l'Epley se réduit à `loadKg * (1 + k)`. On souhaite ici stocker la valeur
 * brute déclarée par l'utilisateur (le 1RM est par définition l'effort à 1 rep
 * RPE 10), pas une re-extrapolation. Donc on retourne directement la charge
 * effective.
 */
export function e1rmFromKnown1RM(
  loadKg: number,
  exercise: Exercise,
  bodyweightKg: number,
): number {
  return effectiveLoadForE1rm(loadKg, exercise, bodyweightKg);
}

// =============================================================================
// 4. Bornes UI
// =============================================================================

export const SUBMAX_REPS_MIN = 3;
export const SUBMAX_REPS_MAX = 8;
export const SUBMAX_RPE_MIN = 6;
export const SUBMAX_RPE_MAX = 10;
export const SUBMAX_RPE_STEP = 0.5;

export interface SubmaxValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

export function validateSubmaxInput(
  loadKg: number,
  reps: number,
  rpe: number,
  charge: ChargeType,
): SubmaxValidation {
  if (charge !== ChargeType.BODYWEIGHT && !(loadKg > 0)) {
    return { ok: false, reason: 'Charge à saisir (> 0 kg).' };
  }
  if (!Number.isInteger(reps) || reps < SUBMAX_REPS_MIN || reps > SUBMAX_REPS_MAX) {
    return { ok: false, reason: `Reps entre ${SUBMAX_REPS_MIN} et ${SUBMAX_REPS_MAX}.` };
  }
  if (rpe < SUBMAX_RPE_MIN || rpe > SUBMAX_RPE_MAX) {
    return { ok: false, reason: `RPE entre ${SUBMAX_RPE_MIN} et ${SUBMAX_RPE_MAX}.` };
  }
  if (!measurementIsReliable(reps, rpe)) {
    return {
      ok: false,
      reason: 'Charge trop légère : reste sous 15 reps équivalent-échec (reps + 10 − RPE).',
    };
  }
  return { ok: true, reason: null };
}

/** Mode "1RM connu" disponible pour les charges où ça a un sens. */
export function allowsKnown1RM(charge: ChargeType): boolean {
  return (
    charge === ChargeType.BARBELL ||
    charge === ChargeType.DUMBBELL ||
    charge === ChargeType.MACHINE_STACK ||
    charge === ChargeType.CABLE ||
    charge === ChargeType.BODYWEIGHT_LOADED
  );
}

/** Label contextuel pour la saisie de charge selon le type d'exercice. */
export function loadLabelFor(charge: ChargeType): string {
  switch (charge) {
    case ChargeType.BODYWEIGHT_LOADED:
      return 'Charge ajoutée (kg)';
    case ChargeType.BODYWEIGHT_ASSISTED:
      return 'Assistance utilisée (kg)';
    case ChargeType.BODYWEIGHT:
      return 'Charge (kg, laisser 0)';
    case ChargeType.DUMBBELL:
      return 'Charge par haltère (kg)';
    default:
      return 'Charge (kg)';
  }
}
