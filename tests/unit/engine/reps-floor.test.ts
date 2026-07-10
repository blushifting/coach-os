/**
 * Chantier D — cliquet de reps (`prescribed_reps_floor`), miroir du cliquet de
 * charge pour les exos au poids du corps PUR et le mode PDC.
 * Couvre : périmètre + exclusivité avec le cliquet de charge, seed (pur vs PDC),
 * graduation plancher+3, anti-régression, descente sur 2 séances, cap 30 (+ lest),
 * plancher bas 5, skip en semaine de récupération acceptée.
 */

import { describe, expect, it } from 'vitest';

import {
  buildPrescription,
  exerciseUsesLoadFloor,
  exerciseUsesRepsFloor,
  targetRepsForPdc,
} from '@/engine/prescription';
import {
  ADOPTION_RESERVE,
  GRADUATION_RESERVE,
  REPS_FLOOR_MAX,
  REPS_FLOOR_MIN,
  updatePrescribedLoadFloorForExercise,
  updatePrescribedRepsFloorForExercise,
} from '@/engine/feedback';
import { recordFeedback } from '@/engine/engine';
import { Catalog } from '@/engine/catalog';
import type { SetFeedback, SessionFeedback, UserState } from '@/engine/models';
import {
  MuscleObjective,
  MuscleStatus,
  makeEquipmentOverride,
  makeMuscleGoal,
  makeUserState,
} from '@/engine/models';

import { profile } from './_helpers';

const catalog = new Catalog();
const PUSHUP = 'pushup'; // poids du corps PUR (charge externe = 0), pectoraux prim.
const PUSHUP_LOADED = 'pushup_loaded'; // bodyweight_loaded → PDC par défaut (#63).
const BENCH = 'bench_bb'; // barre → piloté par le cliquet de CHARGE.

const prio = (muscle: string, obj: MuscleObjective) =>
  makeMuscleGoal({ muscle, objective: obj, status: MuscleStatus.PRIORITAIRE, priority_rank: 1 });

/** State avec un objectif pectoraux donné (pilote pushup / pushup_loaded). */
function stateFor(obj: MuscleObjective = MuscleObjective.HYPERTROPHIE): UserState {
  const s = makeUserState(profile());
  s.muscle_goals = { pectoraux: prio('pectoraux', obj) };
  return s;
}

/** State avec pushup_loaded forcé en mode PDC (poids du corps seulement). */
function pdcState(): UserState {
  const s = stateFor();
  s.equipment_overrides[PUSHUP_LOADED] = makeEquipmentOverride({ pdc_only: true });
  return s;
}

/** Feedback d'une série au poids du corps (charge externe = 0 par défaut). */
function fb(exId: string, reps: number, rpe: number, load = 0): SetFeedback {
  return { exercise_id: exId, reps_done: reps, load_kg: load, rpe_perceived: rpe };
}

function session(sets: SetFeedback[], week: number): SessionFeedback {
  return {
    seance_date: '2026-02-01',
    week_in_cycle: week,
    cycle_index: 1,
    rpe_target: 7,
    sets,
    label: 'A',
    custom_name: null,
  };
}

const pastSession = (sets: SetFeedback[]): SessionFeedback => session(sets, 1);

describe('constantes du cliquet de reps', () => {
  it('cap haut = 30, plancher bas = 5, adoption = 2', () => {
    expect(REPS_FLOOR_MAX).toBe(30);
    expect(REPS_FLOOR_MIN).toBe(5);
    expect(ADOPTION_RESERVE).toBe(2);
  });
});

describe('périmètre & exclusivité avec le cliquet de charge', () => {
  it('poids du corps PUR : reps-floor oui, load-floor non', () => {
    const s = stateFor();
    expect(exerciseUsesRepsFloor(s, catalog.get(PUSHUP))).toBe(true);
    expect(exerciseUsesLoadFloor(s, catalog.get(PUSHUP))).toBe(false);
  });

  it('mode PDC (override) : reps-floor oui, load-floor non', () => {
    const s = pdcState();
    expect(exerciseUsesRepsFloor(s, catalog.get(PUSHUP_LOADED))).toBe(true);
    expect(exerciseUsesLoadFloor(s, catalog.get(PUSHUP_LOADED))).toBe(false);
  });

  it('lestable SANS override : PDC par défaut → reps-floor oui, load-floor non (#63)', () => {
    // #63 — un exo lestable (bodyweight_loaded) se fait au poids du corps tant
    // que l'user n'a pas décidé d'ajouter du lest → cliquet de REPS par défaut.
    const s = stateFor();
    expect(exerciseUsesRepsFloor(s, catalog.get(PUSHUP_LOADED))).toBe(true);
    expect(exerciseUsesLoadFloor(s, catalog.get(PUSHUP_LOADED))).toBe(false);
  });

  it('lesté AVEC override (pdc_only=false) : load-floor oui, reps-floor non (#63)', () => {
    // Décision explicite d'ajouter du lest → repasse au cliquet de CHARGE.
    const s = stateFor();
    s.equipment_overrides[PUSHUP_LOADED] = makeEquipmentOverride({ pdc_only: false });
    expect(exerciseUsesRepsFloor(s, catalog.get(PUSHUP_LOADED))).toBe(false);
    expect(exerciseUsesLoadFloor(s, catalog.get(PUSHUP_LOADED))).toBe(true);
  });

  it('barre : load-floor oui, reps-floor non', () => {
    const s = stateFor();
    expect(exerciseUsesRepsFloor(s, catalog.get(BENCH))).toBe(false);
    expect(exerciseUsesLoadFloor(s, catalog.get(BENCH))).toBe(true);
  });

  it('update reps-floor no-op sur un exo à cliquet de charge (barre)', () => {
    const s = stateFor();
    s.prescribed_reps_floor[BENCH] = 10; // ne devrait pas exister, mais on vérifie l'inertie
    updatePrescribedRepsFloorForExercise(s, catalog.get(BENCH), [fb(BENCH, 10, 7, 60)]);
    expect(s.prescribed_reps_floor[BENCH]).toBe(10);
  });

  it('update load-floor no-op sur un exo à cliquet de reps (pushup)', () => {
    const s = stateFor();
    const before = { ...s.prescribed_load_floor };
    updatePrescribedLoadFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 30, 8)]);
    expect(s.prescribed_load_floor).toEqual(before);
  });
});

describe('seed du plancher de reps', () => {
  it('poids du corps PUR : seed = reps fixes de l’objectif (10 en hyp compound), charge 0', () => {
    const s = stateFor();
    expect(s.prescribed_reps_floor[PUSHUP]).toBeUndefined();
    const pres = buildPrescription(catalog.get(PUSHUP), 100, s.profile, 1, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(10);
    expect(pres.reps).toBe(10);
    expect(pres.load_kg).toBe(0);
    // Un exo à cliquet de reps ne touche jamais le cliquet de charge.
    expect(s.prescribed_load_floor[PUSHUP]).toBeUndefined();
  });

  it('mode PDC : seed = targetRepsForPdc (Epley inverse sur l’e1RM réel), > 1', () => {
    const s = pdcState();
    const e1rm = 120; // > poids du corps (80) → plusieurs reps possibles.
    // #63 — targetRepsForPdc n'est utilisé que sur un e1RM MESURÉ (sinon reps
    // objectif). On simule donc un plafond mesuré.
    s.e1rm[PUSHUP_LOADED] = e1rm;
    const pres = buildPrescription(catalog.get(PUSHUP_LOADED), e1rm, s.profile, 1, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    const expected = targetRepsForPdc(e1rm, s.profile.bodyweight_kg, 7);
    expect(expected).toBeGreaterThan(1);
    expect(s.prescribed_reps_floor[PUSHUP_LOADED]).toBe(expected);
    expect(pres.reps).toBe(expected);
    expect(pres.load_kg).toBe(0);
  });

  it('prescriptions suivantes : les reps = le plancher (plus le seed)', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 17;
    const pres = buildPrescription(catalog.get(PUSHUP), 100, s.profile, 1, {
      muscleGoals: s.muscle_goals,
      state: s,
    });
    expect(pres.reps).toBe(17);
    expect(pres.load_kg).toBe(0);
  });
});

describe('graduation (plancher = R, seuil n_équiv = plancher + 3)', () => {
  it('GRADUATION_RESERVE vaut 3', () => {
    expect(GRADUATION_RESERVE).toBe(3);
  });

  it('meilleure série à plancher+3 → +1 rep', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 10 reps RIR 3 (rpe 7) → n_équiv 13 = 10 + 3.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 10, 7)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(11);
  });

  it('fatigue ignorée : 1 série à plancher+3, les autres plus dures → gradue quand même', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [
      fb(PUSHUP, 10, 7), // n_équiv 13 (la meilleure)
      fb(PUSHUP, 9, 9), // n_équiv 10
      fb(PUSHUP, 8, 9), // n_équiv 9
    ]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(11);
  });

  it('sous le seuil (n_équiv plancher+2) → pas de graduation', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 10 reps rpe 8 → n_équiv 12 < 13.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 10, 8)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(10);
  });
});

describe('anti-régression (plus de reps que le plancher)', () => {
  it('plus de reps + réserve (n_équiv ≥ plancher+2) mais sous le seuil de gradu → adopte les reps', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 11 reps rpe 9 → n_équiv 12 : ≥ 10+2, < 10+3 → adoption seule, pas de +1.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 11, 9)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(11);
  });

  it('plus de reps mais à l’échec (n_équiv < plancher+2) → non adopté', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 11 reps rpe 10 → n_équiv 11 < 12 : pas assez de réserve.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 11, 10)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(10);
  });

  it('gros dépassement facile → adopte les reps puis +1 (comme le cliquet de charge)', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 14 reps rpe 8 → n_équiv 16 : adoption (14) + graduation (+1) = 15.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 14, 8)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(15);
  });
});

describe('cap haut REPS_FLOOR_MAX (30) — bascule vers le lest', () => {
  it('au cap : performance graduante → reste 30 (plus de graduation)', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 30;
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 35, 8)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(30);
  });

  it('graduation ne dépasse jamais le cap', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 29;
    // 29 reps rpe 7 → n_équiv 32 ≥ 32 → +1 mais plafonné à 30.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 29, 7)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(30);
  });
});

describe('descente (hystérésis : 2 séances de suite sous le plancher)', () => {
  it('1 seule séance sous le plancher (historique vide) → no-op', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    // 5 reps rpe 10 → n_équiv 5 < 10, mais aucune séance précédente.
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 5, 10)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(10);
  });

  it('séance précédente ET courante sous le plancher → −1 rep', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    s.history.push(pastSession([fb(PUSHUP, 6, 10)])); // n_équiv 6 < 10
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 5, 10)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(9);
  });

  it('la descente ne va jamais sous REPS_FLOOR_MIN (5)', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 5;
    s.history.push(pastSession([fb(PUSHUP, 3, 10)])); // n_équiv 3 < 5
    updatePrescribedRepsFloorForExercise(s, catalog.get(PUSHUP), [fb(PUSHUP, 2, 10)]);
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(5);
  });
});

describe('skip en récupération (semaine 5)', () => {
  it('semaine 5 ACCEPTÉE → plancher inchangé malgré une perf graduante', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    s.deload_decision = 'accepted';
    recordFeedback(s, catalog, session([fb(PUSHUP, 10, 7)], 5));
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(10);
  });

  it('semaine 5 REFUSÉE → semaine normale, le plancher gradue', () => {
    const s = stateFor();
    s.prescribed_reps_floor[PUSHUP] = 10;
    s.deload_decision = 'declined';
    recordFeedback(s, catalog, session([fb(PUSHUP, 10, 7)], 5));
    expect(s.prescribed_reps_floor[PUSHUP]).toBe(11);
  });
});
