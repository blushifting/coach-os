/**
 * Sets allocator — refonte « plan de volume » (recherche/09b).
 *
 * Les séries ne sont plus « allouées » par un bump glouton après coup : elles
 * sont le **produit direct** du plan de volume, déjà posées sur chaque case
 * (`cell.planned_sets`) par `buildSkeleton`. Ce module ne fait plus que
 * convertir un squelette REMPLI (chaque case a son `chosen_exercise_id`) en
 * `DayTemplate[]`, en lisant les séries planifiées.
 *
 * Supprimés (09b) : init 3 + bump vers V_cible, `reduceJunkVolume`, contraintes
 * durée/plafond (le volume est borné par les objectifs eux-mêmes).
 */

import type {
  DayTemplate,
  PlannedExercise,
  SkeletonTemplate,
  UserState,
} from './models';
import {
  MuscleStatus,
  ProgressionRule,
  makePlannedExercise,
} from './models';
import type { Catalog } from './catalog';
import { effectiveCycleTargetVolume } from './volume';
import { cycleSetProgression } from './cycle_planner';
import { buildSessionLabel } from './skeleton_builder';

/** Bornes dures séries/exo (rappel, alignées sur volume.ts). */
export const MIN_SETS_PER_EXERCISE = 3;
export const MAX_SETS_PER_EXERCISE = 5;

export interface AllocateSetsResult {
  days: DayTemplate[];
  warnings: string[];
  /** Volume hebdo réalisé par muscle (séries pondérées) après remplissage. */
  realized_volume: Record<string, number>;
  /** Muscles prio dont la cible n'est pas atteinte. */
  undershoot_muscles: string[];
}

/**
 * Convertit le squelette rempli en `DayTemplate[]`. Chaque case remplie devient
 * un `PlannedExercise` dont `base_sets` = `cell.planned_sets` (borné 3-5).
 */
export function allocateSets(
  skeleton: SkeletonTemplate,
  state: UserState,
  catalog: Catalog,
): AllocateSetsResult {
  const warnings: string[] = [];
  const realized: Record<string, number> = {};

  const days: DayTemplate[] = skeleton.days.map((sd) => {
    const exercises: PlannedExercise[] = [];
    for (const cell of sd.cells) {
      if (cell.chosen_exercise_id === null) {
        warnings.push(
          `${sd.split_label}: case ${cell.pattern}/${cell.primary_muscle} non remplie`,
        );
        continue;
      }
      if (!catalog.has(cell.chosen_exercise_id)) {
        warnings.push(
          `${sd.split_label}: exo inconnu ${cell.chosen_exercise_id} ignoré`,
        );
        continue;
      }
      const sets = Math.max(
        MIN_SETS_PER_EXERCISE,
        Math.min(MAX_SETS_PER_EXERCISE, cell.planned_sets ?? MIN_SETS_PER_EXERCISE),
      );
      exercises.push(
        makePlannedExercise({
          exercise_id: cell.chosen_exercise_id,
          base_sets: sets,
          progression: cycleSetProgression(sets),
          progression_rule: ProgressionRule.ISRAETEL_VOLUME,
        }),
      );
      const ex = catalog.get(cell.chosen_exercise_id);
      for (const [muscle, coef] of Object.entries(ex.muscles)) {
        realized[muscle] = (realized[muscle] ?? 0) + sets * coef;
      }
    }
    return {
      day_index: sd.day_index,
      label: buildSessionLabel(sd),
      target_muscles_focus: [...sd.focus_muscles],
      exercises,
    };
  });

  // Diagnostic : muscles prio sous leur cible.
  const undershoot: string[] = [];
  for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
    if (goal.status !== MuscleStatus.PRIORITAIRE) continue;
    const target = effectiveCycleTargetVolume(state, muscle);
    const got = realized[muscle] ?? 0;
    if (target > 0 && got < target - 0.5) {
      undershoot.push(muscle);
      warnings.push(
        `${muscle}: ${got.toFixed(1)} séries vs cible ${target.toFixed(1)}. ` +
          `Envisage +1 séance ou une prio de plus.`,
      );
    }
  }

  return {
    days,
    warnings,
    realized_volume: realized,
    undershoot_muscles: undershoot,
  };
}
