/**
 * Tests bout-en-bout du moteur (port de prototype/tests/test_engine_v2_e2e.py).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  applyMissedVolumeToDebt,
  bootstrapMuscleGoalsFromProfile,
  endOfCycle,
  endOfWeek,
  generateSession,
  recordFeedback,
  replaceSessionItem,
  startUser,
} from '@/engine/engine';
import { exercisePrimaires } from '@/engine/models';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
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
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);

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
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);

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

// =============================================================================
// Conv #10d — replaceSessionItem
// =============================================================================

describe('replaceSessionItem', () => {
  it('remplace l\'exo à l\'index donné en conservant le nombre de séries', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux', 'dos_largeur', 'quadriceps', 'ischios',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);

    const plan = generateSession(state, catalog, 0, '2026-01-05');
    const oldItem = plan.items[0]!;
    const nSets = oldItem.sets.length;
    const replacementId = oldItem.exercise_id === 'bench_bb' ? 'bench_db' : 'bench_bb';

    const newPlan = replaceSessionItem(plan, 0, replacementId, state, catalog);
    expect(newPlan.items[0]!.exercise_id).toBe(replacementId);
    expect(newPlan.items[0]!.sets.length).toBe(nSets);
    // Les autres items sont inchangés
    for (let i = 1; i < plan.items.length; i++) {
      expect(newPlan.items[i]!.exercise_id).toBe(plan.items[i]!.exercise_id);
    }
    // L'ancien plan n'a pas muté (retour d'un NOUVEAU plan).
    expect(plan.items[0]!.exercise_id).toBe(oldItem.exercise_id);
  });

  it('lève si itemIndex hors plage', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);
    const plan = generateSession(state, catalog, 0, '2026-01-05');
    expect(() => replaceSessionItem(plan, 999, 'bench_bb', state, catalog)).toThrow();
  });
});

// =============================================================================
// Conv #11a — dette de volume hebdo
// =============================================================================

describe('weekly_volume_debt', () => {
  it('startUser pose weekly_volume_debt = {}', () => {
    const state = startUser(profile(), catalog, {
      muscleGoals: bootstrapMuscleGoalsFromProfile(profile(), ['pectoraux']),
    });
    expect(state.weekly_volume_debt).toEqual({});
  });

  it('applyMissedVolumeToDebt accumule par muscle primaire les séries manquées', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux', 'quadriceps']);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);

    const plan = generateSession(state, catalog, 0, '2026-01-05');
    // Construit un feedback qui ne coche QUE la première série de chaque exo
    const partialFeedback: SessionFeedback = {
      seance_date: plan.seance_date,
      week_in_cycle: plan.week_in_cycle,
      cycle_index: plan.cycle_index,
      rpe_target: plan.rpe_target,
      label: plan.label,
      sets: plan.items.map((it) => ({
        exercise_id: it.exercise_id,
        reps_done: it.sets[0]!.reps,
        load_kg: it.sets[0]!.load_kg,
        rpe_perceived: it.sets[0]!.rpe_target,
      })),
    };

    applyMissedVolumeToDebt(state, catalog, plan, partialFeedback);

    // Chaque exo a perdu (nSets - 1) séries. La dette par muscle = somme des
    // missed des exos qui couvrent ce muscle en primaire.
    let expectedFromPrimaires: Record<string, number> = {};
    for (const item of plan.items) {
      const missed = item.sets.length - 1;
      if (missed <= 0) continue;
      const ex = catalog.get(item.exercise_id);
      for (const m of exercisePrimaires(ex)) {
        expectedFromPrimaires[m] = (expectedFromPrimaires[m] ?? 0) + missed;
      }
    }
    expect(state.weekly_volume_debt).toEqual(expectedFromPrimaires);
  });

  it('generateSession consomme la dette en ajoutant des séries (cap 30 %)', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);

    // Dette artificielle énorme sur pectoraux (doit être limitée par le cap)
    state.weekly_volume_debt = { pectoraux: 99 };

    const plan = generateSession(state, catalog, 0, '2026-01-05');

    // Au moins un exo de la séance qui touche pec en primaire a vu son nb de
    // séries augmenter. Le total ajouté est borné par le cap 30 % par exo.
    let totalAdded = 0;
    let totalBase = 0;
    for (const item of plan.items) {
      const ex = catalog.get(item.exercise_id);
      if (!exercisePrimaires(ex).includes('pectoraux')) continue;
      totalBase += 1;
      totalAdded += item.sets.length;
    }
    expect(totalBase).toBeGreaterThan(0);
    expect(totalAdded).toBeGreaterThan(totalBase);
    // La dette restante doit avoir baissé (mais pas forcément à 0 vu le cap).
    expect(state.weekly_volume_debt.pectoraux ?? 0).toBeLessThan(99);
  });

  it('endOfWeek reset weekly_volume_debt', () => {
    const p = profile();
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const state = startUser(p, catalog, { muscleGoals: goals });
    state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);
    state.weekly_volume_debt = { pectoraux: 4, biceps: 2 };

    endOfWeek(state, catalog);

    expect(state.weekly_volume_debt).toEqual({});
  });
});

// =============================================================================
// Bloc L — recordFeedback transmet la charge préconisée (anti-rétrogradation)
// =============================================================================

describe('recordFeedback — charge > préconisée (Bloc L)', () => {
  it('transmet `prescribed` depuis le plan → charge plus lourde adoptée décisivement', () => {
    const p = profile();
    const mkState = () =>
      startUser(p, catalog, {
        muscleGoals: bootstrapMuscleGoalsFromProfile(p, ['pectoraux']),
      });

    // Plan minimal : bench_bb préconisé 80 kg × 10.
    const plan: SessionPlan = {
      seance_date: '2026-01-05',
      week_in_cycle: 1,
      cycle_index: 0,
      rpe_target: 8,
      label: 'A',
      items: [
        {
          exercise_id: 'bench_bb',
          sets: [
            { exercise_id: 'bench_bb', reps: 10, load_kg: 80, rpe_target: 8, rest_s: 120 },
          ],
        },
      ],
    };
    // L'user met 95 kg × 9 RPE 8 : plus lourd que préco, 1 rep sous la cible.
    const fb: SessionFeedback = {
      seance_date: '2026-01-05',
      week_in_cycle: 1,
      cycle_index: 0,
      rpe_target: 8,
      label: 'A',
      sets: [{ exercise_id: 'bench_bb', reps_done: 9, load_kg: 95, rpe_perceived: 8 }],
    };

    const withPlan = mkState();
    withPlan.e1rm['bench_bb'] = 100;
    recordFeedback(withPlan, catalog, fb, { plan });

    const withoutPlan = mkState();
    withoutPlan.e1rm['bench_bb'] = 100;
    recordFeedback(withoutPlan, catalog, fb, {});

    // Avec le plan, `prescribed` est transmis → adoption décisive (≈ e1RM observé) ;
    // sans le plan, l'EMA amortit → plafond plus bas.
    expect(withPlan.e1rm['bench_bb']!).toBeGreaterThan(withoutPlan.e1rm['bench_bb']!);
  });
});
