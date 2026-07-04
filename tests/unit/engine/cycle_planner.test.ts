/**
 * Tests du planificateur de cycle (voie unique V3, Conv #39).
 * Couvre : effectiveVolumeBounds (extension MuscleGoal), targetFrequencyV2,
 * cycleSetProgression, autoGenerateCyclePlanV3 (invariants globaux),
 * enforceLengthenedBias, orderSession.
 *
 * NB : les tests des internes legacy (parameterizeSplit, composeSession,
 * exosCountForVolume, compoundCountForObjective, generateCyclePlan) ont été
 * retirés avec la suppression de la voie legacy (Conv #39).
 */

import { describe, expect, it } from 'vitest';

import { applyBalanceRules } from '@/engine/balance';
import { Catalog } from '@/engine/catalog';
import {
  autoGenerateCyclePlanV3,
  cycleSetProgression,
  enforceLengthenedBias,
} from '@/engine/cycle_planner';
import {
  MuscleObjective,
  MuscleStatus,
  type MuscleGoal,
  type UserState,
  exercisePrimaires,
} from '@/engine/models';
import { orderSession, totalSets } from '@/engine/selection';
import {
  effectiveVolumeBounds,
  targetFrequencyV2,
  MAX_TOTAL_SETS_PER_SESSION_V2,
} from '@/engine/volume';

import { profileIntermediaireH, startUserStub } from './_helpers';

const catalog = new Catalog();

// =============================================================================
// Helpers
// =============================================================================

function prio(
  muscle: string,
  obj: MuscleObjective = MuscleObjective.HYPERTROPHIE,
  rank = 1,
): MuscleGoal {
  return { muscle, objective: obj, status: MuscleStatus.PRIORITAIRE, priority_rank: rank };
}

function suggested(muscle: string): MuscleGoal {
  return {
    muscle,
    objective: MuscleObjective.MAINTIEN,
    status: MuscleStatus.SUGGERE,
    priority_rank: 99,
  };
}

function stateInterH4x(): UserState {
  return startUserStub(profileIntermediaireH());
}

function typicalGoals(): Record<string, MuscleGoal> {
  const goals: Record<string, MuscleGoal> = {
    pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
    dos_largeur: prio('dos_largeur', MuscleObjective.HYPERTROPHIE, 2),
    quadriceps: prio('quadriceps', MuscleObjective.HYPERTROPHIE, 3),
  };
  for (const sg of applyBalanceRules(goals)) goals[sg.muscle] = sg;
  return goals;
}

// =============================================================================
// 1. effectiveVolumeBounds (extension MuscleGoal)
// =============================================================================

describe('effectiveVolumeBounds', () => {
  it('NON_COUVERT → (0, 0)', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = {
      muscle: 'pectoraux',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.NON_COUVERT,
      priority_rank: 99,
    };
    expect(effectiveVolumeBounds(state, 'pectoraux')).toEqual([0, 0]);
  });

  // Conv #29 — maintien = bande [MV, MEV] = [0.4×Vmin (plancher 2), Vmin].
  // Le plafond V_max = MEV (= baseMin) pour une lecture de progrès uniforme.
  it('SUGGERE (maintien) → bande [MV, MEV], V_min < V_max', () => {
    const state = stateInterH4x();
    state.muscle_goals.abdos = suggested('abdos');
    const baseMin = state.volume_min.abdos!;
    const [vMin, vMax] = effectiveVolumeBounds(state, 'abdos');
    expect(vMin).toBeCloseTo(Math.max(2, baseMin * 0.4), 6);
    expect(vMax).toBe(baseMin);
    expect(vMin).toBeLessThan(vMax);
    expect(vMin).toBeGreaterThanOrEqual(2);
  });

  it('FORCE → facteur 0.7', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.FORCE);
    const baseMin = state.volume_min.pectoraux!;
    const [vMin] = effectiveVolumeBounds(state, 'pectoraux');
    expect(vMin).toBeCloseTo(baseMin * 0.7, 6);
  });

  it('ENDURANCE → facteur 1.25', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.ENDURANCE);
    const baseMin = state.volume_min.pectoraux!;
    const [vMin] = effectiveVolumeBounds(state, 'pectoraux');
    expect(vMin).toBeCloseTo(baseMin * 1.25, 6);
  });
});

// =============================================================================
// 2. targetFrequencyV2
// =============================================================================

describe('targetFrequencyV2', () => {
  it('hypertrophie inter → fréquence 1-4', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.HYPERTROPHIE);
    const f = targetFrequencyV2('pectoraux', state);
    expect(f).toBeGreaterThanOrEqual(1);
    expect(f).toBeLessThanOrEqual(4);
  });

  it('aucun goal → freq 0', () => {
    const state = stateInterH4x();
    expect(targetFrequencyV2('pectoraux', state)).toBe(0);
  });

  it('cappée par sessions_per_week', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.ENDURANCE);
    expect(targetFrequencyV2('pectoraux', state)).toBeLessThanOrEqual(
      state.profile.sessions_per_week,
    );
  });
});

// =============================================================================
// 3. cycleSetProgression (Bloc L — séries fixes)
// =============================================================================

describe('cycleSetProgression', () => {
  it('5 semaines', () => {
    expect(cycleSetProgression(3).length).toBe(5);
  });

  it('w5 (déload) ≤ w1', () => {
    const p = cycleSetProgression(4);
    expect(p[4]!).toBeLessThanOrEqual(p[0]!);
  });

  it('séries FIXES de w1 à w4 (plus de bump hebdo)', () => {
    const p = cycleSetProgression(4);
    expect(p[0]).toBe(4);
    expect(p[1]).toBe(4);
    expect(p[2]).toBe(4);
    expect(p[3]).toBe(4);
  });

  it('plafonnée au plafond par-exo (5) côté ceiling', () => {
    const p = cycleSetProgression(8);
    expect(p[0]).toBe(5);
    expect(Math.max(...p)).toBeLessThanOrEqual(5);
  });

  it('clamp ceiling-only : ne plancher pas un base sous 3 (le plancher est géré en amont)', () => {
    const p = cycleSetProgression(2);
    expect(p.slice(0, 4)).toEqual([2, 2, 2, 2]);
  });
});

// =============================================================================
// 4. autoGenerateCyclePlanV3 — invariants globaux (voie unique)
// =============================================================================

describe('autoGenerateCyclePlanV3', () => {
  it('n jours = sessions_per_week', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);
    expect(plan.days.length).toBe(state.profile.sessions_per_week);
  });

  it('chaque jour a au moins 1 exo', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('caps par séance respectés (plafond V3)', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);
    for (const day of plan.days) {
      expect(totalSets(day.exercises)).toBeLessThanOrEqual(
        MAX_TOTAL_SETS_PER_SESSION_V2,
      );
    }
  });

  it('priorités couvertes (chaque PRIORITAIRE touché ≥ 1 fois)', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);

    for (const [muscle, goal] of Object.entries(state.muscle_goals)) {
      if (goal.status !== MuscleStatus.PRIORITAIRE) continue;
      let daysWithMuscle = 0;
      for (const day of plan.days) {
        for (const p of day.exercises) {
          const ex = catalog.get(p.exercise_id);
          if (exercisePrimaires(ex).includes(muscle)) {
            daysWithMuscle += 1;
            break;
          }
        }
      }
      expect(daysWithMuscle).toBeGreaterThanOrEqual(1);
    }
  });

  it('progression de longueur 5 sur chaque PlannedExercise', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);
    for (const day of plan.days) {
      for (const p of day.exercises) {
        expect(p.progression.length).toBe(5);
      }
    }
  });

  // Conv #39 — alternance préservée : pas deux jours non-FULL de même kind
  // consécutifs (le bug U/U/L/L). On vérifie via les labels de séance.
  it('alternance respectée pour un profil équilibré 4× (Upper/Lower)', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = autoGenerateCyclePlanV3(state, catalog);
    const kinds = plan.days.map((d) =>
      /upper/i.test(d.label) ? 'U' : /lower/i.test(d.label) ? 'L' : 'X',
    );
    for (let i = 1; i < kinds.length; i += 1) {
      if (kinds[i] !== 'X') {
        expect(kinds[i]).not.toBe(kinds[i - 1]);
      }
    }
  });
});

// =============================================================================
// 5. enforceLengthenedBias (D2 Conv #7, cf. 09 §6.4)
// =============================================================================

describe('enforceLengthenedBias', () => {
  it('substitue si HYP + ≥2 exos et aucun lengthened_bias', () => {
    const state = stateInterH4x();
    state.muscle_goals = {
      fessiers: prio('fessiers', MuscleObjective.HYPERTROPHIE, 1),
    };
    const plan = autoGenerateCyclePlanV3(state, catalog);
    const fessiersExos = plan.days.flatMap((d) =>
      d.exercises
        .map((p) => catalog.get(p.exercise_id))
        .filter((ex) => exercisePrimaires(ex).includes('fessiers')),
    );
    if (fessiersExos.length >= 2) {
      expect(fessiersExos.some((ex) => ex.tags.includes('lengthened_bias'))).toBe(
        true,
      );
    }
  });

  it('idempotent : 2e appel ne change rien si déjà couvert', () => {
    const state = stateInterH4x();
    state.muscle_goals = {
      fessiers: prio('fessiers', MuscleObjective.HYPERTROPHIE, 1),
    };
    const plan = autoGenerateCyclePlanV3(state, catalog);
    const before = plan.days.map((d) => d.exercises.map((p) => p.exercise_id));
    enforceLengthenedBias(plan, state, catalog);
    const after = plan.days.map((d) => d.exercises.map((p) => p.exercise_id));
    expect(after).toEqual(before);
  });
});

// =============================================================================
// 6. orderSession (cf. selection.ts) — sanity
// =============================================================================

describe('orderSession — compounds avant iso', () => {
  it('bench_bb avant iso pec', () => {
    const bench = catalog.get('bench_bb');
    const isoPec = catalog
      .for_muscle_primary('pectoraux')
      .filter((x) => x.type === 'isolation');
    if (isoPec.length === 0) return;
    const ordered = orderSession([isoPec[0]!, bench]);
    expect(ordered[0]!.id).toBe(bench.id);
  });
});
