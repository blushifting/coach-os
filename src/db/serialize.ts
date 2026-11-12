/**
 * Sérialisation `UserState` ↔ `SerializedUserState` (forme stockée en DB).
 *
 * Seul champ non-JSON-natif : `Profile.available_equip: Set<string>` →
 * sérialisé en `string[]`. Tous les autres champs sont des Records ou
 * primitives directement sérialisables.
 */

import type { Profile, UserState } from '@/engine/models';
import {
  DurationCategory,
  EquipmentPreference,
  GymBrand,
  Level,
  Sex,
} from '@/engine/models';
import { loadExercises } from '@/engine/catalog';
import {
  exercisesWithChangedReps,
  hasLegacyMuscleGoals,
  migrateMuscleGoals,
} from '@/engine/intentions';
import type { SerializedProfile, SerializedUserState } from './schema';

let musclesById: Map<string, Readonly<Record<string, number>>> | null = null;

/** Muscles d'un exercice du catalogue livré (`null` pour un exercice personnel). */
function catalogMusclesOf(exerciseId: string): Readonly<Record<string, number>> | null {
  musclesById ??= new Map(loadExercises().map((e) => [e.id, e.muscles]));
  return musclesById.get(exerciseId) ?? null;
}

/**
 * Dump 2.4, étape 2 — anciens objectifs par muscle : la table de reps devient
 * unique (10 / 12). Les exercices dont la cible change perdent leur plancher de
 * charge, re-semé depuis le Plafond à la prochaine prescription. Le Plafond
 * n'est pas touché.
 */
function migratedLoadFloor(s: SerializedUserState): Record<string, number> {
  const floor = { ...(s.prescribed_load_floor ?? {}) };
  if (!hasLegacyMuscleGoals(s.muscle_goals)) return floor;
  for (const id of exercisesWithChangedReps(
    Object.keys(floor),
    s.muscle_goals,
    s.profile.objective,
    catalogMusclesOf,
  )) {
    delete floor[id];
  }
  return floor;
}

export function serializeProfile(p: Profile): SerializedProfile {
  const out: SerializedProfile = {
    sex: p.sex,
    age: p.age,
    level: p.level,
    sessions_per_week: p.sessions_per_week,
    bodyweight_kg: p.bodyweight_kg,
    available_equip: [...p.available_equip].sort(),
  };
  if (p.duration_category !== undefined) {
    out.duration_category = p.duration_category;
  }
  if (p.equipment_preference !== undefined) {
    out.equipment_preference = p.equipment_preference;
  }
  if (p.gym_brand !== undefined) {
    out.gym_brand = p.gym_brand;
  }
  return out;
}

export function deserializeProfile(s: SerializedProfile): Profile {
  const out: Profile = {
    sex: s.sex as Sex,
    age: s.age,
    level: s.level as Level,
    sessions_per_week: s.sessions_per_week,
    bodyweight_kg: s.bodyweight_kg,
    available_equip: new Set(s.available_equip),
  };
  if (s.duration_category !== undefined) {
    out.duration_category = s.duration_category as DurationCategory;
  }
  if (s.equipment_preference !== undefined) {
    out.equipment_preference = s.equipment_preference as EquipmentPreference;
  }
  if (s.gym_brand !== undefined) {
    out.gym_brand = s.gym_brand as GymBrand;
  }
  return out;
}

export function serializeUserState(state: UserState): SerializedUserState {
  return {
    profile: serializeProfile(state.profile),
    e1rm: { ...state.e1rm },
    k_user: { ...state.k_user },
    volume_min: { ...state.volume_min },
    current_week_in_cycle: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
    history: state.history.map((h) => structuredClone(h)),
    last_used_for_muscle: { ...state.last_used_for_muscle },
    muscle_goals: Object.fromEntries(
      Object.entries(state.muscle_goals).map(([k, v]) => [k, { ...v }]),
    ),
    current_cycle_plan:
      state.current_cycle_plan === null ? null : structuredClone(state.current_cycle_plan),
    build_mode: state.build_mode ?? 'auto',
    equipment_overrides: Object.fromEntries(
      Object.entries(state.equipment_overrides).map(([k, v]) => [k, { ...v }]),
    ),
    prescribed_load_floor: { ...state.prescribed_load_floor },
    prescribed_reps_floor: { ...state.prescribed_reps_floor },
    current_skeleton:
      state.current_skeleton === null || state.current_skeleton === undefined
        ? null
        : structuredClone(state.current_skeleton),
    favorite_exercise_per_pattern: { ...(state.favorite_exercise_per_pattern ?? {}) },
    favorite_exercise_ids: [...(state.favorite_exercise_ids ?? [])],
    exercise_pick_counts: { ...(state.exercise_pick_counts ?? {}) },
    deload_decision: state.deload_decision ?? null,
  };
}

export function deserializeUserState(s: SerializedUserState): UserState {
  return {
    profile: deserializeProfile(s.profile),
    e1rm: { ...s.e1rm },
    k_user: { ...s.k_user },
    volume_min: { ...s.volume_min },
    current_week_in_cycle: s.current_week_in_cycle,
    cycle_index: s.cycle_index,
    history: s.history.map((h) => structuredClone(h)),
    last_used_for_muscle: { ...s.last_used_for_muscle },
    // Dump 2.4 — ancien format (objectif + statut) migré à la lecture.
    muscle_goals: migrateMuscleGoals(s.muscle_goals),
    current_cycle_plan:
      s.current_cycle_plan === null ? null : structuredClone(s.current_cycle_plan),
    build_mode: s.build_mode ?? 'auto',
    equipment_overrides: Object.fromEntries(
      Object.entries(s.equipment_overrides).map(([k, v]) => [
        k,
        {
          inc_kg: v.inc_kg,
          min_load_kg: v.min_load_kg,
          max_load_kg: v.max_load_kg,
          // Conv #20 — rétrocompat exports antérieurs.
          pdc_only: ((v as { pdc_only?: boolean | null }).pdc_only) ?? null,
        },
      ]),
    ),
    // Rétrocompat : blobs antérieurs à la refonte progression n'ont pas ce champ.
    prescribed_load_floor: migratedLoadFloor(s),
    // Rétrocompat : blobs antérieurs au chantier D n'ont pas ce champ.
    prescribed_reps_floor: { ...(s.prescribed_reps_floor ?? {}) },
    // Conv #22 — Rétrocompat : blobs antérieurs n'ont pas ces champs.
    current_skeleton: s.current_skeleton ?? null,
    favorite_exercise_per_pattern: { ...(s.favorite_exercise_per_pattern ?? {}) },
    // Bloc F (Conv #31) — migration : si le set unifié est absent (blob
    // antérieur), on le reconstruit depuis les favoris par-pattern existants
    // (valeurs dédupliquées). Les nouveaux blobs portent directement le set.
    favorite_exercise_ids:
      s.favorite_exercise_ids !== undefined
        ? [...s.favorite_exercise_ids]
        : Array.from(new Set(Object.values(s.favorite_exercise_per_pattern ?? {}))),
    exercise_pick_counts: { ...(s.exercise_pick_counts ?? {}) },
    // Chantier B — rétrocompat : blobs antérieurs n'ont pas ce champ (default null).
    deload_decision: s.deload_decision ?? null,
  };
}
