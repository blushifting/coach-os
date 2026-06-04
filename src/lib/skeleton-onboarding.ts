/**
 * Helpers d'orchestration du squelette dans le wizard d'onboarding (Conv #22).
 *
 * Sert à :
 *   - Construire le squelette à partir du draft (étape D).
 *   - Auto-fill un squelette avec les favoris user + 1er candidat canonique
 *     (utilisé au passage Step5 → Step6 pour proposer un point de départ).
 *   - Appliquer les choix de variantes du draft sur un squelette.
 *   - Compter les cases remplies (progress bar / garde-fou).
 *   - Construire le `WeeklyTemplate` final avant le récap (étape F).
 *
 * Tout en mémoire, aucune écriture DB.
 */

import type { Catalog } from '@/engine/catalog';
import {
  DurationCategory,
  type MuscleGoal,
  type PatternCell,
  type Profile,
  type SkeletonDay,
  type SkeletonTemplate,
  type UserState,
  type WeeklyTemplate,
} from '@/engine/models';
import { startUser as engineStartUser } from '@/engine/engine';
import { buildSkeleton } from '@/engine/skeleton_builder';
import {
  generateCyclePlanV2,
} from '@/engine/cycle_planner';
import { candidatesForCell } from '@/engine/pattern_grid';

/** Clé canonique d'une case dans `chosenVariantsPerCell`. */
export function cellKey(dayIndex: number, cellIndex: number): string {
  return `${dayIndex}:${cellIndex}`;
}

/**
 * Construit un squelette à partir des inputs onboarding (mémoire).
 * Pas de chosen_exercise_id posé — c'est l'étape E qui s'en charge.
 */
export function buildOnboardingSkeleton(
  profile: Profile,
  muscleGoals: Record<string, MuscleGoal>,
  durationCategory: DurationCategory,
  catalog: Catalog,
): { skeleton: SkeletonTemplate; tmpState: UserState } {
  const tmpState = engineStartUser(profile, catalog, {
    muscleGoals,
    applyBalance: false,
  });
  const skeleton = buildSkeleton(tmpState, durationCategory);
  return { skeleton, tmpState };
}

/**
 * Applique les choix du draft (`chosenVariantsPerCell`) sur un squelette
 * fraîchement construit. Mutation : pose `chosen_exercise_id` sur les cases
 * dont la clé est dans `chosenVariantsPerCell`.
 */
export function applyChosenVariantsToSkeleton(
  skeleton: SkeletonTemplate,
  chosenVariantsPerCell: Readonly<Record<string, string>>,
): SkeletonTemplate {
  const days: SkeletonDay[] = skeleton.days.map((day) => ({
    ...day,
    cells: day.cells.map((cell, ci) => {
      const key = cellKey(day.day_index, ci);
      const chosen = chosenVariantsPerCell[key];
      return chosen !== undefined
        ? { ...cell, chosen_exercise_id: chosen }
        : { ...cell };
    }),
  }));
  return { ...skeleton, days };
}

/**
 * Pour chaque case non remplie, propose la 1re variante du tri
 * `candidatesForCell` — qui tient compte de la **préférence d'équipement**
 * (Conv #22) et des favoris user. Sert à l'auto-fill du squelette dans le
 * flow d'onboarding co-construit : l'user voit directement une liste d'exos
 * cohérente avec sa préférence, et peut modifier au récap.
 *
 * Mutation : pose `chosen_exercise_id` sur les cases vides uniquement.
 */
export function autoFillSkeletonDefaults(
  skeleton: SkeletonTemplate,
  catalog: Catalog,
  favorites: Readonly<Record<string, string>> = {},
  equipmentPreference?: import('@/engine/models').EquipmentPreference,
): SkeletonTemplate {
  const usedIds = new Set<string>();
  for (const day of skeleton.days) {
    for (const c of day.cells) {
      if (c.chosen_exercise_id !== null) usedIds.add(c.chosen_exercise_id);
    }
  }

  const days: SkeletonDay[] = skeleton.days.map((day) => ({
    ...day,
    cells: day.cells.map((cell) => {
      if (cell.chosen_exercise_id !== null) return { ...cell };
      const favoriteId = favorites[cell.pattern];
      const opts: Parameters<typeof candidatesForCell>[2] = {
        excludeIds: usedIds,
      };
      if (favoriteId !== undefined) opts.favoriteId = favoriteId;
      if (equipmentPreference !== undefined)
        opts.equipmentPreference = equipmentPreference;
      const cands = candidatesForCell(cell, catalog, opts);
      const pick = cands[0];
      if (pick) {
        usedIds.add(pick.id);
        return { ...cell, chosen_exercise_id: pick.id };
      }
      return { ...cell };
    }),
  }));
  return { ...skeleton, days };
}

/** Total nb cells dans un squelette. */
export function totalCells(skeleton: SkeletonTemplate): number {
  return skeleton.days.reduce((acc, d) => acc + d.cells.length, 0);
}

/** Nb cells remplies (chosen_exercise_id non null). */
export function filledCells(skeleton: SkeletonTemplate): number {
  let n = 0;
  for (const d of skeleton.days) {
    for (const c of d.cells) {
      if (c.chosen_exercise_id !== null) n += 1;
    }
  }
  return n;
}

/** True si toutes les cases sont remplies. */
export function isSkeletonFullyFilled(skeleton: SkeletonTemplate): boolean {
  return filledCells(skeleton) === totalCells(skeleton);
}

/**
 * Pose le squelette rempli en `WeeklyTemplate` via le solveur F.
 * Échoue (renvoie null) si au moins une case n'est pas remplie.
 */
export function buildFinalPlanFromSkeleton(
  skeleton: SkeletonTemplate,
  tmpState: UserState,
  catalog: Catalog,
): WeeklyTemplate | null {
  if (!isSkeletonFullyFilled(skeleton)) return null;
  return generateCyclePlanV2(skeleton, tmpState, catalog);
}

/**
 * Sérialise les choix d'un squelette vers un `chosenVariantsPerCell` mainte­
 * nable dans le draft. Utile après auto-fill par défaut pour matérialiser
 * les choix initiaux.
 */
export function chosenVariantsFromSkeleton(
  skeleton: SkeletonTemplate,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const day of skeleton.days) {
    day.cells.forEach((cell, ci) => {
      if (cell.chosen_exercise_id !== null) {
        out[cellKey(day.day_index, ci)] = cell.chosen_exercise_id;
      }
    });
  }
  return out;
}

/** Pour le typing import dans les composants. */
export type { PatternCell, SkeletonDay, SkeletonTemplate };
