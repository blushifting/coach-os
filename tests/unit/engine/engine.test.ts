/**
 * Tests bout-en-bout du moteur (port de prototype/tests/test_engine_v2_e2e.py).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  bootstrapMuscleGoalsFromProfile,
  endOfCycle,
  endOfWeek,
  generateSession,
  recordFeedback,
  startUser,
} from '@/engine/engine';
import { generateCyclePlan } from '@/engine/cycle_planner';
import { applyUserActionAfterCycle } from '@/engine/lifecycle';
import { SuggestedAction } from '@/engine/models';
import type {
  SessionFeedback,
  SessionPlan,
  SetFeedback,
} from '@/engine/models';
import { profile } from './_helpers';

const catalog = new Catalog();

function faithfulFeedbackFromPlan(plan: SessionPlan): SessionFeedback {
  const fbSets: SetFeedback[] = [];
  for (const item of plan.items) {
    for (const sp of item.sets) {
      fbSets.push({
        exercise_id: sp.exercise_id,
        reps_done: sp.reps,
        load_kg: sp.load_kg,
        rpe_perceived: sp.rpe_target,
      });
    }
  }
  return {
    seance_date: plan.seance_date,
    week_in_cycle: plan.week_in_cycle,
    cycle_index: plan.cycle_index,
    rpe_target: plan.rpe_target,
    sets: fbSets,
    label: plan.label,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Engine e2e', () => {
  it('1 cycle complet (5 semaines × 4 séances) sans crash', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux', 'dos_largeur', 'quadriceps', 'ischios',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = generateCyclePlan(state, catalog);

    let curDate = '2026-01-05';
    for (let week = 0; week < 5; week++) {
      for (let dayIdx = 0; dayIdx < p.sessions_per_week; dayIdx++) {
        const plan = generateSession(state, catalog, dayIdx, curDate);
        const sf = faithfulFeedbackFromPlan(plan);
        recordFeedback(state, catalog, sf);
        curDate = addDays(curDate, 1);
      }
      endOfWeek(state, catalog);
    }

    expect([1, 5]).toContain(state.current_week_in_cycle);
    expect(state.history).toHaveLength(20);
  });

  it('endOfCycle + applyUserActionAfterCycle(CONTINUER) → nouveau plan', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux', 'dos_largeur', 'quadriceps', 'ischios',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = generateCyclePlan(state, catalog);

    let curDate = '2026-01-05';
    for (let week = 0; week < 5; week++) {
      for (let dayIdx = 0; dayIdx < p.sessions_per_week; dayIdx++) {
        const plan = generateSession(state, catalog, dayIdx, curDate);
        const sf = faithfulFeedbackFromPlan(plan);
        recordFeedback(state, catalog, sf);
        curDate = addDays(curDate, 1);
      }
      endOfWeek(state, catalog);
    }

    endOfCycle(state, catalog);
    const cycleAvant = state.cycle_index;
    applyUserActionAfterCycle(state, catalog, SuggestedAction.CONTINUER_PAREIL);
    expect(state.cycle_index).toBe(cycleAvant + 1);
    expect(state.current_cycle_plan).not.toBeNull();
    expect(state.current_week_in_cycle).toBe(1);
  });
});
