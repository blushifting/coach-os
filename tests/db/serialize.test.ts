import { describe, it, expect } from 'vitest';
import { serializeUserState, deserializeUserState } from '@/db/serialize';
import { startUser } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';
import { makeTestMuscleGoals, makeTestProfile } from '@/test-utils/fixtures';

describe('serialize.ts — round-trip UserState ↔ SerializedUserState', () => {
  it('round-trip de UserState minimal préserve tous les champs scalaires', () => {
    const profile = makeTestProfile();
    const catalog = new Catalog();
    const state = startUser(profile, catalog, { muscleGoals: makeTestMuscleGoals() });

    const restored = deserializeUserState(serializeUserState(state));

    expect(restored.profile.sex).toBe(state.profile.sex);
    expect(restored.profile.age).toBe(state.profile.age);
    expect(restored.profile.bodyweight_kg).toBe(state.profile.bodyweight_kg);
    expect(restored.cycle_index).toBe(state.cycle_index);
    expect(restored.current_week_in_cycle).toBe(state.current_week_in_cycle);
    expect(restored.recovery_mode).toBe(state.recovery_mode);
  });

  it('convertit Profile.available_equip Set ↔ string[] sans perte', () => {
    const profile = makeTestProfile();
    const catalog = new Catalog();
    const state = startUser(profile, catalog);

    const serialized = serializeUserState(state);
    expect(Array.isArray(serialized.profile.available_equip)).toBe(true);
    expect([...state.profile.available_equip].sort()).toEqual(
      serialized.profile.available_equip,
    );

    const restored = deserializeUserState(serialized);
    expect(restored.profile.available_equip).toBeInstanceOf(Set);
    expect(restored.profile.available_equip.has('bb_oly')).toBe(true);
    expect(restored.profile.available_equip.size).toBe(state.profile.available_equip.size);
  });

  it('préserve muscle_goals avec leurs enums', () => {
    const profile = makeTestProfile();
    const catalog = new Catalog();
    const state = startUser(profile, catalog, { muscleGoals: makeTestMuscleGoals() });

    const restored = deserializeUserState(serializeUserState(state));
    expect(Object.keys(restored.muscle_goals).sort()).toEqual(
      Object.keys(state.muscle_goals).sort(),
    );
    expect(restored.muscle_goals['pectoraux']?.objective).toBe(
      state.muscle_goals['pectoraux']?.objective,
    );
    expect(restored.muscle_goals['pectoraux']?.priority_rank).toBe(1);
  });

  it('survit à un round-trip JSON.stringify / JSON.parse', () => {
    const profile = makeTestProfile();
    const catalog = new Catalog();
    const state = startUser(profile, catalog, { muscleGoals: makeTestMuscleGoals() });

    const json = JSON.stringify(serializeUserState(state));
    const restored = deserializeUserState(JSON.parse(json));

    expect(restored.profile.bodyweight_kg).toBe(80);
    expect(restored.muscle_goals['pectoraux']?.muscle).toBe('pectoraux');
    expect(restored.profile.available_equip.has('cable_low')).toBe(true);
  });
});
