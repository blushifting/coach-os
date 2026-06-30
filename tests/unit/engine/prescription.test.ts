/**
 * Miroir TS de prototype/tests/test_prescription.py + test_prescription_muscle_goals.py.
 * Couvre :
 *   - Epley pur, Epley étendu (RIR > 0).
 *   - Inversion (target_load round-trip).
 *   - Domaine de validité des mesures (n_équiv ≤ 15).
 *   - Arrondi (incrément, plancher, bascule 5kg ≥ 150 kg).
 *   - RPE par phase / objectif (legacy).
 *   - Voie muscle_goals : primaryMuscleGoal, target_rpe/reps_for_exercise.
 *   - effective_increment et build_prescription (legacy + nouveau).
 */

import { describe, expect, it } from 'vitest';

import {
  EPLEY_K,
  buildPrescription,
  e1rmObserved,
  effectiveIncrement,
  measurementIsReliable,
  nEquiv,
  primaryMuscleGoal,
  roundToIncrement,
  targetLoad,
  targetRepsForExercise,
  targetRpe,
  targetRpeForExercise,
} from '@/engine/prescription';
import { Catalog } from '@/engine/catalog';
import {
  ExType,
  MuscleObjective,
  MuscleStatus,
  Objective,
  makeEquipmentOverride,
  makeMuscleGoal,
  makeUserState,
} from '@/engine/models';

import { profile } from './_helpers';

void EPLEY_K;
const catalog = new Catalog();

// =============================================================================
// 1. Epley pur (RPE 10 = échec)
// =============================================================================

describe('Epley pur (RPE 10)', () => {
  it("100kg × 5 reps à l'échec → e1RM ≈ 116.65 kg", () => {
    expect(e1rmObserved(100, 5, 10)).toBeCloseTo(116.65, 2);
  });
  it("100kg × 1 rep à l'échec → e1RM ≈ 103.33 kg", () => {
    expect(e1rmObserved(100, 1, 10)).toBeCloseTo(103.33, 2);
  });
  it("100kg × 10 reps à l'échec → e1RM ≈ 133.30 kg", () => {
    expect(e1rmObserved(100, 10, 10)).toBeCloseTo(133.3, 2);
  });
});

// =============================================================================
// 2. Epley étendu (RIR > 0)
// =============================================================================

describe('Epley étendu (RIR > 0)', () => {
  it('100 kg × 5 à RPE 8 (n_eq = 7) → e1RM ≈ 123.31 kg', () => {
    expect(e1rmObserved(100, 5, 8)).toBeCloseTo(123.31, 2);
  });
  it('100 kg × 3 à RPE 9 (n_eq = 4) → e1RM ≈ 113.32 kg', () => {
    expect(e1rmObserved(100, 3, 9)).toBeCloseTo(113.32, 2);
  });
  it('n_equiv', () => {
    expect(nEquiv(5, 8)).toBe(7);
    expect(nEquiv(8, 7)).toBe(11);
    expect(nEquiv(1, 10)).toBe(1);
  });
});

// =============================================================================
// 3. Inversion : charge cible
// =============================================================================

describe('targetLoad — inverse de e1rmObserved', () => {
  it('round-trip exact pour différents (reps, rpe)', () => {
    const e1rm = 120;
    for (const reps of [3, 5, 8, 10]) {
      for (const rpe of [7, 8, 9, 10]) {
        const load = targetLoad(e1rm, reps, rpe);
        expect(e1rmObserved(load, reps, rpe)).toBeCloseTo(e1rm, 2);
      }
    }
  });
  it('1 rep à RPE 10 ≈ 96.78 % du e1RM', () => {
    expect(targetLoad(100, 1, 10)).toBeCloseTo(96.78, 1);
  });
});

// =============================================================================
// 4. Domaine de validité des mesures
// =============================================================================

describe('measurementIsReliable', () => {
  it('fiable si n_eq ≤ 15', () => {
    expect(measurementIsReliable(10, 8)).toBe(true); // n_eq = 12
    expect(measurementIsReliable(5, 10)).toBe(true); // n_eq = 5
    expect(measurementIsReliable(12, 7)).toBe(true); // n_eq = 15
  });
  it('non fiable si n_eq > 15', () => {
    expect(measurementIsReliable(15, 7)).toBe(false); // n_eq = 18
  });
});

// =============================================================================
// 5. Arrondi
// =============================================================================

describe('roundToIncrement', () => {
  it.each([
    [82.7, 2.5, 82.5],
    [83.8, 2.5, 85.0],
    [60.4, 1.25, 60.0],
    [60.7, 1.25, 61.25],
    [12.0, 5.0, 10.0],
    [13.0, 5.0, 15.0],
  ])('round(%f, %f) = %f', (load, inc, expected) => {
    expect(roundToIncrement(load, inc)).toBeCloseTo(expected, 5);
  });

  it('au-dessus de 150 kg, on bascule sur 5 kg même si l’incrément est plus petit', () => {
    expect(roundToIncrement(152.3, 2.5)).toBe(150);
    expect(roundToIncrement(157.0, 2.5)).toBe(155);
  });

  it('plancher à 0', () => {
    expect(roundToIncrement(-5, 2.5)).toBe(0);
  });
});

// =============================================================================
// 6. RPE par phase / objectif (legacy)
// =============================================================================

describe('targetRpe (legacy)', () => {
  // Refonte progression — plus de rampe intra-cycle : RPE de référence CONSTANT
  // (sem 1..4), seul le déload (sem 5) abaisse à 6.
  it('constant sem 1..4, déload sem 5 = 6', () => {
    expect(targetRpe(Objective.HYPERTROPHIE, 1)).toBe(7);
    expect(targetRpe(Objective.HYPERTROPHIE, 4)).toBe(7);
    expect(targetRpe(Objective.HYPERTROPHIE, 5)).toBe(6);
  });
  it('même valeur quel que soit l’objectif (hors déload)', () => {
    expect(targetRpe(Objective.FORCE, 4)).toBe(7);
    expect(targetRpe(Objective.ENDURANCE, 2)).toBe(7);
  });
  it('hors plage → throw', () => {
    expect(() => targetRpe(Objective.HYPERTROPHIE, 6)).toThrow();
  });
});

// =============================================================================
// 7. Plage RPE valide
// =============================================================================

describe('e1rmObserved — plage RPE', () => {
  it('rpe > 10 → throw', () => {
    expect(() => e1rmObserved(100, 5, 11)).toThrow();
  });
  it('rpe = 0 → throw', () => {
    expect(() => e1rmObserved(100, 5, 0)).toThrow();
  });
});

// =============================================================================
// 8. primaryMuscleGoal — sélection du goal qui pilote la prescription
// =============================================================================

const prio = (
  muscle: string,
  obj: MuscleObjective = MuscleObjective.HYPERTROPHIE,
  rank = 1,
) => makeMuscleGoal({ muscle, objective: obj, status: MuscleStatus.PRIORITAIRE, priority_rank: rank });

describe('primaryMuscleGoal', () => {
  it('un seul primaire dans goals → renvoie ce goal', () => {
    const bench = catalog.get('bench_bb');
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.FORCE, 1) };
    const g = primaryMuscleGoal(bench, goals);
    expect(g).not.toBeNull();
    expect(g!.muscle).toBe('pectoraux');
    expect(g!.objective).toBe(MuscleObjective.FORCE);
  });

  it('synergiste (coef < 1.0) ne pilote jamais la prescription', () => {
    const bench = catalog.get('bench_bb');
    const synCoef = bench.muscles['triceps'] ?? 0;
    if (synCoef < 1.0) {
      const goals = { triceps: prio('triceps', MuscleObjective.FORCE, 1) };
      expect(primaryMuscleGoal(bench, goals)).toBeNull();
    }
  });

  it('aucun primaire dans goals → null', () => {
    expect(primaryMuscleGoal(catalog.get('bench_bb'), {})).toBeNull();
  });

  it('NON_COUVERT exclu', () => {
    const bench = catalog.get('bench_bb');
    const goals = {
      pectoraux: makeMuscleGoal({
        muscle: 'pectoraux',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.NON_COUVERT,
        priority_rank: 99,
      }),
    };
    expect(primaryMuscleGoal(bench, goals)).toBeNull();
  });

  it('rang le plus petit gagne (deadlift_conv : ischios + lombaires)', () => {
    const dl = catalog.get('deadlift_conv');
    const primaires = Object.entries(dl.muscles)
      .filter(([, c]) => c >= 1.0)
      .map(([m]) => m);
    expect(primaires.length).toBeGreaterThanOrEqual(2);
    const [m1, m2] = primaires;
    const goals = {
      [m1!]: prio(m1!, MuscleObjective.HYPERTROPHIE, 5),
      [m2!]: prio(m2!, MuscleObjective.HYPERTROPHIE, 1),
    };
    expect(primaryMuscleGoal(dl, goals)!.muscle).toBe(m2);
  });

  it('égalité de rang : Force > Hypertrophie', () => {
    const dl = catalog.get('deadlift_conv');
    const primaires = Object.entries(dl.muscles)
      .filter(([, c]) => c >= 1.0)
      .map(([m]) => m);
    const [m1, m2] = primaires;
    const goals = {
      [m1!]: prio(m1!, MuscleObjective.HYPERTROPHIE, 1),
      [m2!]: prio(m2!, MuscleObjective.FORCE, 1),
    };
    expect(primaryMuscleGoal(dl, goals)!.objective).toBe(MuscleObjective.FORCE);
  });

  it('pec rank 1 vs triceps rank 4 sur bench → bench suit pec', () => {
    const bench = catalog.get('bench_bb');
    const goals = {
      pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1),
      triceps: prio('triceps', MuscleObjective.FORCE, 4),
    };
    const g = primaryMuscleGoal(bench, goals)!;
    expect(g.muscle).toBe('pectoraux');
    expect(g.objective).toBe(MuscleObjective.HYPERTROPHIE);
  });
});

// =============================================================================
// 9. targetRpeForExercise — courbes par MuscleObjective + déload + recovery
// =============================================================================

describe('targetRpeForExercise', () => {
  const bench = catalog.get('bench_bb');

  it('Force semaine 1 → 7.0', () => {
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.FORCE, 1) };
    expect(targetRpeForExercise(bench, 1, goals)).toBe(7.0);
  });

  it('Hypertrophie constant (plus de rampe) → 7.0', () => {
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1) };
    expect(targetRpeForExercise(bench, 1, goals)).toBe(7.0);
    expect(targetRpeForExercise(bench, 4, goals)).toBe(7.0);
  });

  it('Maintien → 6.0', () => {
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.MAINTIEN, 1) };
    expect(targetRpeForExercise(bench, 4, goals)).toBe(6.0);
  });

  it('Déload semaine 5 → 6.0 quel que soit l’objectif', () => {
    for (const obj of Object.values(MuscleObjective)) {
      const goals = { pectoraux: prio('pectoraux', obj, 1) };
      expect(targetRpeForExercise(bench, 5, goals)).toBe(6.0);
    }
  });

  it('recovery_mode plafonne à 7 (Endurance 8 → 7)', () => {
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.ENDURANCE, 1) };
    expect(targetRpeForExercise(bench, 1, goals)).toBe(8.0);
    expect(targetRpeForExercise(bench, 1, goals, true)).toBe(7.0);
  });

  it('fallback Hypertrophie si aucun goal → sem 1 = 7.0', () => {
    expect(targetRpeForExercise(bench, 1, {})).toBe(7.0);
  });
});

// =============================================================================
// 10. targetRepsForExercise — fourchettes par MuscleObjective + poly/iso
// =============================================================================

describe('targetRepsForExercise', () => {
  // Conv #29 — reps FIXES par objectif × type (cf. TARGET_REPS).
  it('Force compound → 5', () => {
    const bench = catalog.get('bench_bb');
    expect(bench.type).toBe(ExType.COMPOUND);
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.FORCE, 1) };
    expect(targetRepsForExercise(bench, goals)).toBe(5);
  });

  it('Hypertrophie compound → 10', () => {
    const bench = catalog.get('bench_bb');
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1) };
    expect(targetRepsForExercise(bench, goals)).toBe(10);
  });

  it('Hypertrophie isolation → 12', () => {
    const isoBiceps = [...catalog].find(
      (e) =>
        e.type === ExType.ISOLATION &&
        Object.entries(e.muscles).some(([m, c]) => m === 'biceps' && c >= 1.0),
    );
    expect(isoBiceps).toBeDefined();
    const goals = { biceps: prio('biceps', MuscleObjective.HYPERTROPHIE, 1) };
    expect(targetRepsForExercise(isoBiceps!, goals)).toBe(12);
  });
});

// =============================================================================
// 11. effectiveIncrement — override équipement par exo
// =============================================================================

describe('effectiveIncrement', () => {
  it('pas d’override → catalogue', () => {
    const state = makeUserState(profile());
    const bench = catalog.get('bench_bb');
    expect(effectiveIncrement(state, bench)).toBe(bench.inc_kg);
  });

  it('override avec inc_kg → utilisé', () => {
    const state = makeUserState(profile());
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({ inc_kg: 5 });
    expect(effectiveIncrement(state, catalog.get('bench_bb'))).toBe(5);
  });

  it('override avec inc_kg=null → fallback catalogue', () => {
    const state = makeUserState(profile());
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({
      inc_kg: null,
      max_load_kg: 200,
    });
    const bench = catalog.get('bench_bb');
    expect(effectiveIncrement(state, bench)).toBe(bench.inc_kg);
  });
});

// =============================================================================
// 12. buildPrescription — rétrocompat + extension muscle_goals
// =============================================================================

describe('buildPrescription', () => {
  it('signature legacy inchangée', () => {
    const bench = catalog.get('bench_bb');
    const p = profile();
    const pres = buildPrescription(bench, 100, p, 1);
    expect(pres.exercise_id).toBe('bench_bb');
    expect(pres.reps).toBeGreaterThan(0);
    expect(pres.rpe_target).toBe(7.0);
  });

  it('avec muscle_goals (Force pec rank 1) : RPE 7.0, reps 5', () => {
    const bench = catalog.get('bench_bb');
    const p = profile();
    const state = makeUserState(p);
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.FORCE, 1) };
    const pres = buildPrescription(bench, 100, p, 1, { muscleGoals: goals, state });
    expect(pres.rpe_target).toBe(7.0);
    expect(pres.reps).toBe(5);
  });

  it('recovery_mode plafonne RPE à 7 même via muscle_goals', () => {
    const bench = catalog.get('bench_bb');
    const p = profile();
    const state = makeUserState(p);
    state.recovery_mode = true;
    const goals = { pectoraux: prio('pectoraux', MuscleObjective.HYPERTROPHIE, 1) };
    const pres = buildPrescription(bench, 100, p, 4, {
      muscleGoals: goals,
      state,
      recoveryMode: true,
    });
    expect(pres.rpe_target).toBeLessThanOrEqual(7.0);
  });

  it('override inc_kg=5 → charge multiple de 5', () => {
    const bench = catalog.get('bench_bb');
    const p = profile();
    const state = makeUserState(p);
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({ inc_kg: 5 });
    const pres = buildPrescription(bench, 100, p, 1, { state });
    expect(pres.load_kg % 5).toBe(0);
  });

  it('pdc_only=true sur pullup (BW_LOADED) → load=0, reps adaptées', () => {
    // Conv #20 — un pullup avec e1rm total = bw + 30kg et bw=70kg : on
    // attend ~13 reps à RPE 7 (formule Epley étendu).
    const pullup = catalog.get('pullup');
    const p = profile({ bodyweight_kg: 70 });
    const state = makeUserState(p);
    state.equipment_overrides['pullup'] = makeEquipmentOverride({
      pdc_only: true,
    });
    const e1rmTotal = 100; // bw + 30 kg équivaut à e1RM total = 100
    const pres = buildPrescription(pullup, e1rmTotal, p, 1, { state });
    expect(pres.load_kg).toBe(0);
    expect(pres.reps).toBeGreaterThanOrEqual(8);
    expect(pres.reps).toBeLessThanOrEqual(20);
  });

  it('pdc_only=true sur exo non-BW (bench) → ignoré', () => {
    const bench = catalog.get('bench_bb');
    const p = profile();
    const state = makeUserState(p);
    state.equipment_overrides['bench_bb'] = makeEquipmentOverride({
      pdc_only: true,
    });
    const pres = buildPrescription(bench, 100, p, 1, { state });
    // Le flag est ignoré (bench n'est pas BW) → on a une charge calculée
    // par la voie standard.
    expect(pres.load_kg).toBeGreaterThan(0);
  });
});
