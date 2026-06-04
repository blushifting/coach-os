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
  Level,
  Objective,
  Sex,
} from '@/engine/models';
import type { SerializedProfile, SerializedUserState } from './schema';

export function serializeProfile(p: Profile): SerializedProfile {
  const out: SerializedProfile = {
    sex: p.sex,
    age: p.age,
    level: p.level,
    objective: p.objective,
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
  return out;
}

export function deserializeProfile(s: SerializedProfile): Profile {
  const out: Profile = {
    sex: s.sex as Sex,
    age: s.age,
    level: s.level as Level,
    objective: s.objective as Objective,
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
  return out;
}

export function serializeUserState(state: UserState): SerializedUserState {
  return {
    profile: serializeProfile(state.profile),
    e1rm: { ...state.e1rm },
    k_user: { ...state.k_user },
    reps_pr: { ...state.reps_pr },
    volume_min: { ...state.volume_min },
    volume_max: { ...state.volume_max },
    current_week_in_cycle: state.current_week_in_cycle,
    cycle_index: state.cycle_index,
    plateau_counter: { ...state.plateau_counter },
    history: state.history.map((h) => structuredClone(h)),
    last_used_for_muscle: { ...state.last_used_for_muscle },
    muscle_goals: Object.fromEntries(
      Object.entries(state.muscle_goals).map(([k, v]) => [k, { ...v }]),
    ),
    current_cycle_plan:
      state.current_cycle_plan === null ? null : structuredClone(state.current_cycle_plan),
    active_guided_program_id: state.active_guided_program_id,
    recovery_mode: state.recovery_mode,
    recovery_weeks_remaining: state.recovery_weeks_remaining,
    equipment_overrides: Object.fromEntries(
      Object.entries(state.equipment_overrides).map(([k, v]) => [k, { ...v }]),
    ),
    weekly_volume_debt: { ...state.weekly_volume_debt },
    fixed_routine: { ...state.fixed_routine },
    current_skeleton:
      state.current_skeleton === null || state.current_skeleton === undefined
        ? null
        : structuredClone(state.current_skeleton),
    favorite_exercise_per_pattern: { ...(state.favorite_exercise_per_pattern ?? {}) },
    deload_strategy: state.deload_strategy ?? null,
  };
}

export function deserializeUserState(s: SerializedUserState): UserState {
  return {
    profile: deserializeProfile(s.profile),
    e1rm: { ...s.e1rm },
    k_user: { ...s.k_user },
    reps_pr: { ...s.reps_pr },
    volume_min: { ...s.volume_min },
    volume_max: { ...s.volume_max },
    current_week_in_cycle: s.current_week_in_cycle,
    cycle_index: s.cycle_index,
    plateau_counter: { ...s.plateau_counter },
    history: s.history.map((h) => structuredClone(h)),
    last_used_for_muscle: { ...s.last_used_for_muscle },
    muscle_goals: Object.fromEntries(
      Object.entries(s.muscle_goals).map(([k, v]) => [
        k,
        {
          muscle: v.muscle,
          objective: v.objective as UserState['muscle_goals'][string]['objective'],
          status: v.status as UserState['muscle_goals'][string]['status'],
          priority_rank: v.priority_rank,
        },
      ]),
    ),
    current_cycle_plan:
      s.current_cycle_plan === null ? null : structuredClone(s.current_cycle_plan),
    active_guided_program_id: s.active_guided_program_id,
    recovery_mode: s.recovery_mode,
    recovery_weeks_remaining: s.recovery_weeks_remaining,
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
    // Rétrocompat : blobs antérieurs à Conv #11a n'ont pas ce champ.
    weekly_volume_debt: { ...(s.weekly_volume_debt ?? {}) },
    // Rétrocompat : blobs antérieurs à Conv #18 n'ont pas ce champ.
    fixed_routine: { ...(s.fixed_routine ?? {}) },
    // Conv #22 — Rétrocompat : blobs antérieurs n'ont pas ces champs.
    current_skeleton: s.current_skeleton ?? null,
    favorite_exercise_per_pattern: { ...(s.favorite_exercise_per_pattern ?? {}) },
    deload_strategy: s.deload_strategy ?? null,
  };
}
