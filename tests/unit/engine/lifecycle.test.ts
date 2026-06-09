/**
 * Tests du lifecycle (port de prototype/tests/test_lifecycle.py).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  RECOVERY_RPE_CAP,
  adjustVolumeBoundsAtCycleEnd,
  applyUserActionAfterCycle,
  decrementRecoveryWeek,
  enterRecoveryMode,
  generateCycleReview,
  maybeExitRecoveryMode,
  suggestNextAction,
} from '@/engine/lifecycle';
import {
  bootstrapMuscleGoalsFromProfile,
  generateSession,
  startUser,
} from '@/engine/engine';
import { generateCyclePlan } from '@/engine/cycle_planner';
import {
  MuscleObjective,
  MuscleStatus,
  Objective,
  SuggestedAction,
  makeMuscleGoal,
} from '@/engine/models';
import type { Profile, SessionFeedback, UserState } from '@/engine/models';
import { profile } from './_helpers';

const catalog = new Catalog();

function profileTest(): Profile {
  return profile();
}

function stateWithPlan(): UserState {
  const p = profileTest();
  const goals = bootstrapMuscleGoalsFromProfile(p, [
    'pectoraux', 'dos_largeur', 'quadriceps', 'ischios',
  ]);
  const state = startUser(p, catalog, { muscleGoals: goals });
  state.current_cycle_plan = generateCyclePlan(state, catalog);
  return state;
}

// =============================================================================
// 1. suggestNextAction
// =============================================================================

describe('suggestNextAction', () => {
  it('adhérence basse → AJUSTER', () => {
    expect(suggestNextAction([], [], [], 0.5)).toBe(SuggestedAction.AJUSTER_OBJECTIFS);
  });

  it('3 plateaux → CHANGER_PROGRAMME', () => {
    expect(suggestNextAction([], ['pec', 'dos', 'quad'], [], 0.9)).toBe(
      SuggestedAction.CHANGER_PROGRAMME,
    );
  });

  it('cycle réussi → TOURNER_EMPHASIS', () => {
    expect(suggestNextAction(['pec', 'dos', 'quad'], [], [], 0.9)).toBe(
      SuggestedAction.TOURNER_EMPHASIS,
    );
  });

  it('cas neutre → CONTINUER_PAREIL', () => {
    expect(suggestNextAction(['pec'], ['dos'], [], 0.8)).toBe(
      SuggestedAction.CONTINUER_PAREIL,
    );
  });
});

// =============================================================================
// 2. generateCycleReview
// =============================================================================

describe('generateCycleReview', () => {
  it('historique vide', () => {
    const state = stateWithPlan();
    const review = generateCycleReview(state, catalog);
    expect(review.cycle_index).toBe(state.cycle_index);
    expect(review.adherence_pct).toBe(0);
    expect(review.muscles_progresses).toEqual([]);
    expect(review.muscles_plateau).toEqual([]);
    expect(review.PRs).toEqual([]);
  });

  it('quelques sessions → adhérence > 0', () => {
    const state = stateWithPlan();
    for (let i = 0; i < 3; i++) {
      const sf: SessionFeedback = {
        seance_date: `2026-01-0${5 + i}`,
        week_in_cycle: 1,
        cycle_index: state.cycle_index,
        rpe_target: 7.0,
        sets: [{
          exercise_id: 'bench_bb',
          reps_done: 5,
          load_kg: 80,
          rpe_perceived: 8,
        }],
        label: '',
      };
      state.history.push(sf);
      state.e1rm['bench_bb'] = 100;
    }
    const review = generateCycleReview(state, catalog);
    expect(review.adherence_pct).toBeGreaterThan(0);
    expect(review.volume_total_kg).toBeGreaterThan(0);
  });
});

// =============================================================================
// 3. adjustVolumeBoundsAtCycleEnd
// =============================================================================

describe('adjustVolumeBoundsAtCycleEnd', () => {
  it('overshoot augmente Vmax', () => {
    const state = stateWithPlan();
    const before = state.volume_max['pectoraux']!;
    const review = generateCycleReview(state, catalog);
    review.muscles_overshoot = ['pectoraux'];
    adjustVolumeBoundsAtCycleEnd(state, review);
    expect(state.volume_max['pectoraux']!).toBeGreaterThan(before);
  });

  it('plateau diminue Vmax', () => {
    const state = stateWithPlan();
    const before = state.volume_max['pectoraux']!;
    const review = generateCycleReview(state, catalog);
    review.muscles_plateau = ['pectoraux'];
    adjustVolumeBoundsAtCycleEnd(state, review);
    expect(state.volume_max['pectoraux']!).toBeLessThan(before);
  });

  it('undertrained diminue Vmin', () => {
    const state = stateWithPlan();
    const before = state.volume_min['pectoraux']!;
    const review = generateCycleReview(state, catalog);
    review.muscles_undertrained = ['pectoraux'];
    adjustVolumeBoundsAtCycleEnd(state, review);
    expect(state.volume_min['pectoraux']!).toBeLessThan(before);
  });

  it('undertrained génère un warning volume minimum', () => {
    const state = stateWithPlan();
    const review = generateCycleReview(state, catalog);
    review.muscles_undertrained = ['pectoraux'];
    review.warnings = [];
    adjustVolumeBoundsAtCycleEnd(state, review);
    expect(review.warnings.some((w) => w.includes('Volume minimum'))).toBe(true);
  });
});

// =============================================================================
// 4. Recovery mode
// =============================================================================

describe('Recovery mode', () => {
  it('enterRecoveryMode active le flag', () => {
    const state = stateWithPlan();
    enterRecoveryMode(state, 2);
    expect(state.recovery_mode).toBe(true);
    expect(state.recovery_weeks_remaining).toBe(2);
  });

  it('decrementRecoveryWeek décrémente', () => {
    const state = stateWithPlan();
    enterRecoveryMode(state, 2);
    decrementRecoveryWeek(state);
    expect(state.recovery_weeks_remaining).toBe(1);
    expect(state.recovery_mode).toBe(true);
  });

  it('decrementRecoveryWeek sort à 0', () => {
    const state = stateWithPlan();
    enterRecoveryMode(state, 1);
    decrementRecoveryWeek(state);
    expect(state.recovery_weeks_remaining).toBe(0);
    expect(state.recovery_mode).toBe(false);
  });

  it('maybeExit ne sort pas si remaining > 0', () => {
    const state = stateWithPlan();
    enterRecoveryMode(state, 2);
    expect(maybeExitRecoveryMode(state)).toBe(false);
    expect(state.recovery_mode).toBe(true);
  });
});

// =============================================================================
// 5. applyUserActionAfterCycle
// =============================================================================

describe('applyUserActionAfterCycle', () => {
  it('CONTINUER → cycle++ et plan régénéré', () => {
    const state = stateWithPlan();
    const cycleAvant = state.cycle_index;
    applyUserActionAfterCycle(state, catalog, SuggestedAction.CONTINUER_PAREIL);
    expect(state.cycle_index).toBe(cycleAvant + 1);
    expect(state.current_week_in_cycle).toBe(1);
    expect(state.current_cycle_plan).not.toBeNull();
  });

  it('TOURNER → permute pec ↔ dos_largeur', () => {
    const state = stateWithPlan();
    const rPec = state.muscle_goals['pectoraux']!.priority_rank;
    const rDos = state.muscle_goals['dos_largeur']!.priority_rank;
    applyUserActionAfterCycle(state, catalog, SuggestedAction.TOURNER_EMPHASIS);
    expect(state.muscle_goals['pectoraux']!.priority_rank).toBe(rDos);
    expect(state.muscle_goals['dos_largeur']!.priority_rank).toBe(rPec);
  });

  it('AJUSTER → pas de regen automatique', () => {
    const state = stateWithPlan();
    const planAvant = state.current_cycle_plan;
    applyUserActionAfterCycle(state, catalog, SuggestedAction.AJUSTER_OBJECTIFS);
    expect(state.current_cycle_plan).toBe(planAvant);
    expect(state.cycle_index).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 6. generateSession (lit current_cycle_plan)
// =============================================================================

describe('generateSession', () => {
  it('lit current_cycle_plan.days[day_index]', () => {
    const state = stateWithPlan();
    const plan = generateSession(state, catalog, 0, '2026-01-05');
    expect(plan.label).toBe(state.current_cycle_plan!.days[0].label);
    expect(plan.items.length).toBeGreaterThanOrEqual(1);
  });

  it('sans plan → throw', () => {
    const p = profileTest();
    const state = startUser(p, catalog);
    expect(state.current_cycle_plan).toBeNull();
    expect(() => generateSession(state, catalog, 0, '2026-01-05')).toThrow();
  });

  it('en recovery_mode, RPE cible ≤ 7', () => {
    const state = stateWithPlan();
    enterRecoveryMode(state, 2);
    const plan = generateSession(state, catalog, 0, '2026-01-05');
    for (const item of plan.items) {
      for (const s of item.sets) {
        expect(s.rpe_target).toBeLessThanOrEqual(RECOVERY_RPE_CAP + 0.001);
      }
    }
  });
});

// =============================================================================
// 7. bootstrapMuscleGoalsFromProfile
// =============================================================================

describe('bootstrapMuscleGoalsFromProfile', () => {
  it('rangs dans l\'ordre', () => {
    const p = profileTest();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux', 'dos_largeur', 'biceps']);
    expect(goals['pectoraux']!.priority_rank).toBe(1);
    expect(goals['dos_largeur']!.priority_rank).toBe(2);
    expect(goals['biceps']!.priority_rank).toBe(3);
  });

  it('objective correspond au profile', () => {
    const p = profile({ objective: Objective.FORCE });
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    expect(goals['pectoraux']!.objective).toBe(MuscleObjective.FORCE);
  });

  it('startUser avec muscle_goals applique R1-R4', () => {
    const p = profileTest();
    const goals = {
      pectoraux: makeMuscleGoal({
        muscle: 'pectoraux',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 1,
      }),
    };
    const state = startUser(p, catalog, { muscleGoals: goals, applyBalance: true });
    expect('abdos' in state.muscle_goals).toBe(true);
    expect('lombaires' in state.muscle_goals).toBe(true);
    expect('deltos_posterieurs' in state.muscle_goals).toBe(true);
  });

  it('startUser sans muscle_goals → dict vide', () => {
    const state = startUser(profileTest(), catalog);
    expect(state.muscle_goals).toEqual({});
  });
});
