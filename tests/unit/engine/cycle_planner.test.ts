/**
 * Miroir TS de prototype/tests/test_cycle_planner.py.
 * Couvre : effectiveVolumeBounds (extension MuscleGoal), targetFrequency,
 * israetelProgression, exosCountForVolume, compoundCountForObjective,
 * parameterizeSplit, composeSession, generateCyclePlan, rotateEmphasis,
 * orderSession.
 */

import { describe, expect, it } from 'vitest';

import { applyBalanceRules } from '@/engine/balance';
import { Catalog } from '@/engine/catalog';
import {
  DayMeta,
  composeSession,
  compoundCountForObjective,
  enforceLengthenedBias,
  exosCountForVolume,
  generateCyclePlan,
  israetelProgression,
  parameterizeSplit,
  rotateEmphasis,
} from '@/engine/cycle_planner';
import {
  MuscleObjective,
  MuscleStatus,
  type MuscleGoal,
  type UserState,
  exercisePrimaires,
} from '@/engine/models';
import {
  MAX_TOTAL_SETS_PER_SESSION,
  orderSession,
  totalSets,
} from '@/engine/selection';
import { SPLIT_UL_4X, SlotKind } from '@/engine/split';
import {
  effectiveVolumeBounds,
  targetFrequency,
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

function dayMeta(
  dayIndex: number,
  label: string,
  slotKind: SlotKind,
  focus: string[] = [],
): DayMeta {
  return {
    day_index: dayIndex,
    label,
    slot_kind: slotKind,
    target_muscles_focus: [...focus],
  };
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
// 2. targetFrequency
// =============================================================================

describe('targetFrequency', () => {
  it('hypertrophie inter → fréquence 1-4', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.HYPERTROPHIE);
    const f = targetFrequency('pectoraux', state);
    expect(f).toBeGreaterThanOrEqual(1);
    expect(f).toBeLessThanOrEqual(4);
  });

  it('aucun goal → freq 0', () => {
    const state = stateInterH4x();
    expect(targetFrequency('pectoraux', state)).toBe(0);
  });

  it('cappée par sessions_per_week', () => {
    const state = stateInterH4x();
    state.muscle_goals.pectoraux = prio('pectoraux', MuscleObjective.ENDURANCE);
    expect(targetFrequency('pectoraux', state)).toBeLessThanOrEqual(
      state.profile.sessions_per_week,
    );
  });
});

// =============================================================================
// 3. israetelProgression
// =============================================================================

describe('israetelProgression', () => {
  it('5 semaines', () => {
    expect(israetelProgression(3).length).toBe(5);
  });

  it('w5 (déload) ≤ w1', () => {
    const p = israetelProgression(4);
    expect(p[4]!).toBeLessThanOrEqual(p[0]!);
  });

  it('monte de w1 à w4', () => {
    const p = israetelProgression(3);
    expect(p[0]!).toBeLessThanOrEqual(p[1]!);
    expect(p[1]!).toBeLessThanOrEqual(p[2]!);
    expect(p[2]!).toBeLessThanOrEqual(p[3]!);
  });

  it('cappée à v_max_per_exo', () => {
    const p = israetelProgression(8, 10);
    expect(Math.max(...p)).toBeLessThanOrEqual(10);
  });
});

// =============================================================================
// 4. exosCountForVolume / compoundCountForObjective
// =============================================================================

describe('exosCountForVolume', () => {
  it('paliers 1/2/3/4', () => {
    expect(exosCountForVolume(5)).toBe(1);
    expect(exosCountForVolume(10)).toBe(2);
    expect(exosCountForVolume(15)).toBe(3);
    expect(exosCountForVolume(20)).toBe(4);
  });
});

describe('compoundCountForObjective', () => {
  it('FORCE = 100 %', () => {
    expect(compoundCountForObjective(3, MuscleObjective.FORCE)).toBe(3);
  });

  it('HYPERTROPHIE ~60 % (3 → 2)', () => {
    expect(compoundCountForObjective(3, MuscleObjective.HYPERTROPHIE)).toBe(2);
  });
});

// =============================================================================
// 5. parameterizeSplit
// =============================================================================

describe('parameterizeSplit', () => {
  it('n jours = sessions_per_week', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    expect(parameterizeSplit(SPLIT_UL_4X, state.muscle_goals, state).length).toBe(4);
  });

  it('pec dans au moins un jour UPPER', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const dm = parameterizeSplit(SPLIT_UL_4X, state.muscle_goals, state);
    const upperDays = dm.filter((d) => d.slot_kind === SlotKind.UPPER);
    expect(upperDays.some((d) => d.target_muscles_focus.includes('pectoraux'))).toBe(true);
  });

  it('quad dans au moins un jour LOWER', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const dm = parameterizeSplit(SPLIT_UL_4X, state.muscle_goals, state);
    const lowerDays = dm.filter((d) => d.slot_kind === SlotKind.LOWER);
    expect(lowerDays.some((d) => d.target_muscles_focus.includes('quadriceps'))).toBe(true);
  });
});

// =============================================================================
// 6. composeSession — invariants par jour
// =============================================================================

describe('composeSession', () => {
  it('au moins 1 exo si muscles focus', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const day = composeSession(
      dayMeta(0, 'Upper A', SlotKind.UPPER, ['pectoraux']),
      state,
      catalog,
    );
    expect(day.exercises.length).toBeGreaterThanOrEqual(1);
  });

  it('lengthened_bias si Hyp + 2+ exos sur muscle', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    state.volume_min.pectoraux = 12.0;
    state.volume_max.pectoraux = 18.0;
    const day = composeSession(
      dayMeta(0, 'Upper A', SlotKind.UPPER, ['pectoraux']),
      state,
      catalog,
    );
    if (day.exercises.length >= 2) {
      const candidatesLengthened = catalog
        .for_muscle_primary('pectoraux')
        .filter(
          (x) =>
            x.tags.includes('lengthened_bias') &&
            (x.equip.length === 0 ||
              x.equip.every((e) => state.profile.available_equip.has(e))),
        );
      if (candidatesLengthened.length > 0) {
        const anyLengthened = day.exercises.some((p) =>
          catalog.get(p.exercise_id).tags.includes('lengthened_bias'),
        );
        expect(anyLengthened).toBe(true);
      }
    }
  });

  it('SUGGERE seul → ≤ 2 exos (pas d\'explosion)', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    expect(state.muscle_goals.abdos!.status).toBe(MuscleStatus.SUGGERE);
    const day = composeSession(
      dayMeta(0, 'Upper A', SlotKind.UPPER, ['abdos']),
      state,
      catalog,
    );
    expect(day.exercises.length).toBeLessThanOrEqual(2);
  });
});

// =============================================================================
// 7. generateCyclePlan — invariants globaux
// =============================================================================

describe('generateCyclePlan', () => {
  it('n jours = sessions_per_week', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = generateCyclePlan(state, catalog);
    expect(plan.days.length).toBe(state.profile.sessions_per_week);
  });

  it('chaque jour a au moins 1 exo', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = generateCyclePlan(state, catalog);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('caps par séance respectés', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = generateCyclePlan(state, catalog);
    const cap = MAX_TOTAL_SETS_PER_SESSION[state.profile.level];
    for (const day of plan.days) {
      expect(totalSets(day.exercises)).toBeLessThanOrEqual(cap);
    }
  });

  it('priorités couvertes (chaque PRIORITAIRE touché ≥ 1 fois)', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = generateCyclePlan(state, catalog);

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
    const plan = generateCyclePlan(state, catalog);
    for (const day of plan.days) {
      for (const p of day.exercises) {
        expect(p.progression.length).toBe(5);
      }
    }
  });

  it('rationale contient le nom du split', () => {
    const state = stateInterH4x();
    state.muscle_goals = typicalGoals();
    const plan = generateCyclePlan(state, catalog);
    expect(plan.rationale.includes('Upper/Lower') || plan.rationale.includes('U/L')).toBe(
      true,
    );
  });
});

// =============================================================================
// 7b. enforceLengthenedBias (D2 Conv #7, cf. 09 §6.4)
// =============================================================================

describe('enforceLengthenedBias', () => {
  it('substitue si HYP + ≥2 exos et aucun lengthened_bias', () => {
    const state = stateInterH4x();
    state.muscle_goals = {
      fessiers: prio('fessiers', MuscleObjective.HYPERTROPHIE, 1),
    };
    const plan = generateCyclePlan(state, catalog);
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

  it('no-op si objectif FORCE (pas de substitution forcée)', () => {
    const state = stateInterH4x();
    state.muscle_goals = {
      pectoraux: prio('pectoraux', MuscleObjective.FORCE, 1),
    };
    const plan = generateCyclePlan(state, catalog);
    const pecExos = plan.days.flatMap((d) =>
      d.exercises
        .map((p) => catalog.get(p.exercise_id))
        .filter((ex) => exercisePrimaires(ex).includes('pectoraux')),
    );
    expect(pecExos.length).toBeGreaterThan(0);
    // FORCE => essentiellement des compounds, pas de subst forcée par iso lengthened.
    expect(
      pecExos.every((ex) => ex.type === 'compound' || !ex.tags.includes('lengthened_bias')),
    ).toBe(true);
  });

  it('idempotent : 2e appel ne change rien si déjà couvert', () => {
    const state = stateInterH4x();
    state.muscle_goals = {
      fessiers: prio('fessiers', MuscleObjective.HYPERTROPHIE, 1),
    };
    const plan = generateCyclePlan(state, catalog);
    const before = plan.days.map((d) => d.exercises.map((p) => p.exercise_id));
    enforceLengthenedBias(plan, state, catalog);
    const after = plan.days.map((d) => d.exercises.map((p) => p.exercise_id));
    expect(after).toEqual(before);
  });
});

// =============================================================================
// 8. rotateEmphasis
// =============================================================================

describe('rotateEmphasis', () => {
  it('permute pec/dos_largeur', () => {
    const goals: Record<string, MuscleGoal> = {
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
      dos_largeur: prio('dos_largeur', MuscleObjective.HYPERTROPHIE, 2),
    };
    rotateEmphasis(goals);
    expect(goals.pectoraux!.priority_rank).toBe(2);
    expect(goals.dos_largeur!.priority_rank).toBe(1);
  });

  it('un seul du couple → pas de permutation', () => {
    const goals: Record<string, MuscleGoal> = {
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
    };
    rotateEmphasis(goals);
    expect(goals.pectoraux!.priority_rank).toBe(1);
  });

  it('SUGGERE non affecté', () => {
    const goals: Record<string, MuscleGoal> = {
      biceps: prio('biceps', MuscleObjective.HYPERTROPHIE, 1),
      triceps: suggested('triceps'),
    };
    rotateEmphasis(goals);
    expect(goals.biceps!.priority_rank).toBe(1);
    expect(goals.triceps!.priority_rank).toBe(99);
  });
});

// =============================================================================
// 9. orderSession (cf. selection.ts) — sanity
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
