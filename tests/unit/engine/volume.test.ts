/**
 * Miroir TS de prototype/tests/test_volume.py.
 * Couvre : V_min/V_max initiaux, progression hebdo legacy, advanceWeek,
 * détection plateau anticipé.
 */

import { describe, expect, it } from 'vitest';

import {
  Level,
  Objective,
  Sex,
  makeProfile,
} from '@/engine/models';
import { advanceWeek, initialVolumeBounds, targetVolume } from '@/engine/volume';

import { startUserStub } from './_helpers';

function profile(opts: {
  sex?: Sex;
  age?: number;
  level?: Level;
} = {}) {
  return makeProfile({
    sex: opts.sex ?? Sex.HOMME,
    age: opts.age ?? 30,
    level: opts.level ?? Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: opts.sex === Sex.FEMME ? 60 : 80,
  });
}

// =============================================================================
// initialVolumeBounds
// =============================================================================

describe('initialVolumeBounds', () => {
  it('intermédiaire homme : pec V_min=10, V_max=18 ; quad V_min=10 ; tri V_min=8', () => {
    const [vMin, vMax] = initialVolumeBounds(profile());
    expect(vMin['pectoraux']).toBe(10);
    expect(vMax['pectoraux']).toBe(18);
    expect(vMin['quadriceps']).toBe(10);
    expect(vMin['triceps']).toBe(8);
  });

  it('femme : bonus +15% sur le haut du corps, pas sur quadriceps', () => {
    const [vMinH] = initialVolumeBounds(profile());
    const [vMinF] = initialVolumeBounds(profile({ sex: Sex.FEMME }));
    expect(vMinF['pectoraux']).toBeGreaterThan(vMinH['pectoraux']!);
    expect(vMinF['quadriceps']).toBe(vMinH['quadriceps']);
  });

  it('senior (≥50 ans) : −20 % sur tous, V_max plafonné à V_min × 1.5', () => {
    const [vMin, vMax] = initialVolumeBounds(profile({ age: 55 }));
    expect(vMin['pectoraux']).toBeCloseTo(8, 2); // 10 × 0.8
    expect(vMax['pectoraux']).toBeCloseTo(12, 2); // 8 × 1.5
  });
});

// =============================================================================
// targetVolume — progression hebdo legacy
// =============================================================================

describe('targetVolume (legacy)', () => {
  it('5 semaines : 10, 12, 14, 16, 5 (déload)', () => {
    const state = startUserStub(profile());
    const seq: number[] = [];
    for (const w of [1, 2, 3, 4, 5]) {
      state.current_week_in_cycle = w;
      seq.push(targetVolume(state, 'pectoraux'));
    }
    expect(seq).toEqual([10, 12, 14, 16, 5]);
  });
});

// =============================================================================
// advanceWeek
// =============================================================================

describe('advanceWeek', () => {
  it('progression normale 1 → 2 → 3', () => {
    const state = startUserStub(profile());
    advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(2);
    advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(3);
  });

  it('semaine 4 → 5 (déload)', () => {
    const state = startUserStub(profile());
    state.current_week_in_cycle = 4;
    const ev = advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(5);
    expect(ev).toContain('deload');
  });

  it('semaine 5 → 1 du cycle suivant', () => {
    const state = startUserStub(profile());
    state.current_week_in_cycle = 5;
    state.cycle_index = 1;
    advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(1);
    expect(state.cycle_index).toBe(2);
  });

  it('plateau détecté → déload anticipé', () => {
    const state = startUserStub(profile());
    state.current_week_in_cycle = 2;
    state.plateau_counter['pectoraux'] = 2;
    const ev = advanceWeek(state, true);
    expect(state.current_week_in_cycle).toBe(5);
    expect(ev).toContain('plateau');
  });
});
