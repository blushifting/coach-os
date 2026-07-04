/**
 * Refonte progression — cliquet de charge (`prescribed_load_floor`).
 * Couvre : seed depuis l'e1RM, graduation R+3 sur la MEILLEURE série (fatigue
 * ignorée), saut +1 incrément, anti-régression, descente sur 2 séances, déload,
 * exos sans charge externe additive exclus.
 */

import { describe, expect, it } from 'vitest';

import {
  buildPrescription,
  effectiveIncrement,
  exerciseUsesLoadFloor,
} from '@/engine/prescription';
import {
  GRADUATION_RESERVE,
  updatePrescribedLoadFloorForExercise,
} from '@/engine/feedback';
import { Catalog } from '@/engine/catalog';
import type { SetFeedback, SessionFeedback } from '@/engine/models';
import {
  MuscleObjective,
  MuscleStatus,
  makeMuscleGoal,
  makeUserState,
} from '@/engine/models';

import { profile } from './_helpers';

const catalog = new Catalog();
const BENCH = 'bench_bb';

const prio = (muscle: string, obj: MuscleObjective) =>
  makeMuscleGoal({ muscle, objective: obj, status: MuscleStatus.PRIORITAIRE, priority_rank: 1 });

/** State avec un objectif pectoraux donné (pilote bench_bb). */
function stateFor(obj: MuscleObjective) {
  const s = makeUserState(profile());
  s.muscle_goals = { pectoraux: prio('pectoraux', obj) };
  return s;
}

function fb(load: number, reps: number, rpe: number): SetFeedback {
  return { exercise_id: BENCH, reps_done: reps, load_kg: load, rpe_perceived: rpe };
}

function pastSession(sets: SetFeedback[]): SessionFeedback {
  return {
    seance_date: '2026-01-01',
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 7,
    sets,
    label: 'A',
    custom_name: null,
  };
}

const inc = (s = stateFor(MuscleObjective.HYPERTROPHIE)) =>
  effectiveIncrement(s, catalog.get(BENCH));

describe('GRADUATION_RESERVE', () => {
  it('vaut 3 (R reps à RIR 3, juste avant la zone « 4+ »)', () => {
    expect(GRADUATION_RESERVE).toBe(3);
  });
});

describe('seed du plancher', () => {
  it('1re prescription : seed = la charge dérivée de l’e1RM', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    expect(s.prescribed_load_floor[BENCH]).toBeUndefined();
    const pres = buildPrescription(catalog.get(BENCH), 100, s.profile, 1, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    expect(s.prescribed_load_floor[BENCH]).toBe(pres.load_kg);
  });

  it('prescriptions suivantes : la charge = le plancher (plus l’e1RM)', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 42.5;
    const pres = buildPrescription(catalog.get(BENCH), 200, s.profile, 1, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    expect(pres.load_kg).toBe(42.5);
  });
});

describe('graduation R+3 (hypertrophie compound, R=10 → seuil n_équiv 13)', () => {
  it('meilleure série à n_équiv 13 → +1 incrément', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 10 reps RIR 3 (rpe 7) → n_équiv = 13.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(50, 10, 7)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50 + inc());
  });

  it('fatigue ignorée : 1 série à 13, les autres plus basses → gradue quand même', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [
      fb(50, 10, 7), // n_équiv 13 (la meilleure)
      fb(50, 8, 9), // n_équiv 9
      fb(50, 7, 9), // n_équiv 8
    ]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50 + inc());
  });

  it('gros dépassement → toujours +1 incrément seulement (pas multi-crans)', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 13 reps RIR 3 → n_équiv 16, bien au-delà du seuil.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(50, 13, 7)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50 + inc());
  });

  it('sous le seuil (n_équiv 12) → pas de graduation', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(50, 10, 8)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50);
  });
});

describe('anti-régression (charge réelle plus lourde)', () => {
  it('plus lourd + série solide (≥ R) → plancher adopte la charge', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 60 kg × 10 reps RIR 2 → n_équiv 12 : solide (≥10) mais sous le seuil 13.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(60, 10, 8)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(60);
  });

  it('plus lourd mais série ratée (< R) → on n’adopte pas', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 60 kg × 2 reps à l'échec → n_équiv 2 : pas solide.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(60, 2, 10)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50);
  });

  it('plus lourd ET facile (R+3) → adopte la charge puis +1 incrément', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 55 kg × 10 reps RIR 3 → n_équiv 13.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(55, 10, 7)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(55 + inc());
  });
});

describe('descente (hystérésis : 2 séances de suite sous R)', () => {
  it('1 seule séance sous R → pas de descente (no-op)', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    // 5 reps à l'échec → n_équiv 5 < R=10, mais historique vide.
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(50, 5, 10)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50);
  });

  it('séance précédente ET courante sous R → −1 incrément', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    s.history.push(pastSession([fb(50, 6, 10)])); // n_équiv 6 < 10
    updatePrescribedLoadFloorForExercise(s, catalog.get(BENCH), [fb(50, 5, 10)]);
    expect(s.prescribed_load_floor[BENCH]).toBe(50 - inc());
  });
});

describe('exos sans charge externe additive', () => {
  it('bench (barre) est piloté par le cliquet', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    expect(exerciseUsesLoadFloor(s, catalog.get(BENCH))).toBe(true);
  });

  it('graduation ignorée (no-op) sur un exo non piloté (poids du corps / assisté)', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    const exo = [...catalog].find((e) => !exerciseUsesLoadFloor(s, e));
    expect(exo).toBeDefined();
    const before = { ...s.prescribed_load_floor };
    updatePrescribedLoadFloorForExercise(s, exo!, [
      { exercise_id: exo!.id, reps_done: 30, load_kg: 0, rpe_perceived: 8 },
    ]);
    expect(s.prescribed_load_floor).toEqual(before);
  });
});

describe('déload (semaine 5) — charge allégée d’un facteur', () => {
  it('déload actif → charge = plancher × 0,9 arrondie', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    const pres = buildPrescription(catalog.get(BENCH), 100, s.profile, 5, {
      muscleGoals: s.muscle_goals,
      state: s,
      deloadActive: true,
    });
    expect(pres.load_kg).toBe(45);
  });

  it('semaine 5 REFUSÉE (déload non actif) → charge = plancher (pas de ×0,9)', () => {
    const s = stateFor(MuscleObjective.HYPERTROPHIE);
    s.prescribed_load_floor[BENCH] = 50;
    const pres = buildPrescription(catalog.get(BENCH), 100, s.profile, 5, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    expect(pres.load_kg).toBe(50);
  });
});
