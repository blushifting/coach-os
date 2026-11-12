/**
 * Miroir TS de prototype/tests/test_volume.py.
 * Couvre : seuils de croissance initiaux, cible du générateur, progression hebdo legacy, advanceWeek,
 * détection plateau anticipé.
 */

import { describe, expect, it } from 'vitest';

import {
  Level,
  MuscleIntention,
  Sex,
  makeProfile,
  type SessionFeedback,
  type WeeklyTemplate,
} from '@/engine/models';
import {
  advanceWeek,
  cycleAdherence,
  effectiveCycleTargetVolume,
  initialGrowthThresholds,
} from '@/engine/volume';

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
    sessions_per_week: 4,
    bodyweight_kg: opts.sex === Sex.FEMME ? 60 : 80,
  });
}

// =============================================================================
// initialGrowthThresholds
// =============================================================================

describe('initialGrowthThresholds', () => {
  it('intermédiaire homme : pec 10 ; quad 10 ; tri 8', () => {
    const vMin = initialGrowthThresholds(profile());
    expect(vMin['pectoraux']).toBe(10);
    expect(vMin['quadriceps']).toBe(10);
    expect(vMin['triceps']).toBe(8);
  });

  it('femme : bonus +15% sur le haut du corps, pas sur quadriceps', () => {
    const vMinH = initialGrowthThresholds(profile());
    const vMinF = initialGrowthThresholds(profile({ sex: Sex.FEMME }));
    expect(vMinF['pectoraux']).toBeGreaterThan(vMinH['pectoraux']!);
    expect(vMinF['quadriceps']).toBe(vMinH['quadriceps']);
  });

  it('senior (≥50 ans) : −20 % sur tous', () => {
    const vMin = initialGrowthThresholds(profile({ age: 55 }));
    expect(vMin['pectoraux']).toBeCloseTo(8, 2); // 10 × 0.8
  });
});

// =============================================================================
// effectiveCycleTargetVolume (dump 2.4, étape 3 : cible inchangée)
// =============================================================================

describe('effectiveCycleTargetVolume', () => {
  it('Développer → seuil × 1,16 ; Entretenir → plancher ; sans objectif → 0', () => {
    const state = startUserStub(profile());
    state.muscle_goals.pectoraux = { muscle: 'pectoraux', intention: MuscleIntention.DEVELOPPER, priority_rank: 1 };
    state.muscle_goals.abdos = { muscle: 'abdos', intention: MuscleIntention.ENTRETENIR, priority_rank: 99 };
    expect(effectiveCycleTargetVolume(state, 'pectoraux')).toBeCloseTo(11.6, 6);
    expect(effectiveCycleTargetVolume(state, 'abdos')).toBeCloseTo(3.2, 6);
    expect(effectiveCycleTargetVolume(state, 'biceps')).toBe(0);
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

  it('semaine 5 → no-op (bascule de cycle gérée par endOfCycle)', () => {
    // Conv A (plan 11) — la branche w=5 est retirée : advanceWeek ne bascule
    // plus le cycle. `tickWeekIfNeeded` plafonne à 5, cette branche n'est
    // jamais atteinte en flux réel.
    const state = startUserStub(profile());
    state.current_week_in_cycle = 5;
    state.cycle_index = 1;
    const ev = advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(5);
    expect(state.cycle_index).toBe(1);
    expect(ev).toBe('semaine_5_stable');
  });

  it('w=4 → entrée en semaine 5 (deload_fin_de_cycle), sans stratégie', () => {
    const state = startUserStub(profile());
    state.current_week_in_cycle = 4;
    const ev = advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(5);
    expect(ev).toBe('deload_fin_de_cycle');
  });
});

// =============================================================================
// cycleAdherence (Conv A, plan 11) — assiduité unifiée
// =============================================================================

describe('cycleAdherence', () => {
  function sf(cycleIndex: number, week: number): SessionFeedback {
    return {
      seance_date: '2026-05-01',
      week_in_cycle: week,
      cycle_index: cycleIndex,
      rpe_target: 8,
      sets: [],
      label: 'X',
    };
  }
  const plan3: WeeklyTemplate = {
    cycle_index: 1,
    rationale: '',
    days: [0, 1, 2].map((i) => ({
      day_index: i,
      label: `J${i}`,
      target_muscles_focus: [],
      exercises: [],
    })),
    warnings: [],
  };

  it('0 si plan absent', () => {
    const state = startUserStub(profile());
    state.current_cycle_plan = null;
    expect(cycleAdherence(state, 5)).toBe(0);
  });

  it('séances du cycle courant ≤ throughWeek / (jours × throughWeek)', () => {
    const state = startUserStub(profile());
    state.cycle_index = 2;
    state.current_cycle_plan = plan3;
    state.history = [
      sf(2, 1),
      sf(2, 2),
      sf(2, 3), // cycle courant, sem ≤ 4 → comptent
      sf(2, 6), // sem > throughWeek → ignorée
      sf(1, 1), // autre cycle → ignorée
    ];
    // prévu = 3 jours × 4 = 12 ; faites = 3 → 0,25
    expect(cycleAdherence(state, 4)).toBeCloseTo(3 / 12, 5);
  });

  it('les séances libres peuvent pousser la valeur brute au-dessus de 1', () => {
    const state = startUserStub(profile());
    state.cycle_index = 1;
    state.current_cycle_plan = plan3;
    // prévu = 3 × 1 = 3 ; 5 séances faites en sem 1 → 5/3 > 1
    state.history = [sf(1, 1), sf(1, 1), sf(1, 1), sf(1, 1), sf(1, 1)];
    expect(cycleAdherence(state, 1)).toBeCloseTo(5 / 3, 5);
  });
});
