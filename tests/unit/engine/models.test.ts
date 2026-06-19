/**
 * Miroir TS de prototype/tests/test_models_extension.py.
 *
 * Vérifie :
 *   - Création des nouveaux enums et dataclasses
 *   - Rétrocompat de UserState (ancien constructeur sans muscle_goals)
 *   - Conversion Objective → MuscleObjective
 *   - Helpers et invariants simples
 *   - Validation Profile (port de Profile.__post_init__)
 *   - Helpers Exercise (from_dict, primaires, synergistes)
 */

import { describe, expect, it } from 'vitest';

import {
  // Enums existants
  Sex,
  Level,
  Objective,
  // Nouveaux enums
  MuscleObjective,
  MuscleStatus,
  ProgressionRule,
  SuggestedAction,
  // Dataclasses + factories
  makeMuscleGoal,
  makePlannedExercise,
  makeWeeklyTemplate,
  weeklyTemplateSessionsPlanned,
  makeCanonicalExercise,
  makeCycleReview,
  makeEquipmentOverride,
  makeUserState,
  makeProfile,
  // Exercise helpers
  exerciseFromDict,
  exercisePrimaires,
  exerciseSynergistes,
  Pattern,
  ExType,
  ChargeType,
  E1RMApp,
  type ExerciseDict,
  // Helper de conversion
  objectiveToMuscleObjective,
} from '@/engine/models';

// =============================================================================
// 1. Puissance retirée
// =============================================================================

describe('Objective — Puissance retirée en V1 (cf. 09 §3.5)', () => {
  it("L'objectif Puissance n'existe pas dans Objective", () => {
    expect((Objective as Record<string, string>).PUISSANCE).toBeUndefined();
  });

  it("MuscleObjective n'a pas non plus de Puissance", () => {
    expect((MuscleObjective as Record<string, string>).PUISSANCE).toBeUndefined();
  });

  it('Objective V1 = {force, hypertrophie, endurance}', () => {
    expect(new Set(Object.values(Objective))).toEqual(
      new Set(['force', 'hypertrophie', 'endurance']),
    );
  });

  it('MuscleObjective V1 = {force, hypertrophie, endurance, maintien}', () => {
    expect(new Set(Object.values(MuscleObjective))).toEqual(
      new Set(['force', 'hypertrophie', 'endurance', 'maintien']),
    );
  });
});

// =============================================================================
// 2. Conversion Objective → MuscleObjective
// =============================================================================

describe('objectiveToMuscleObjective — round trip', () => {
  it('FORCE → FORCE', () => {
    expect(objectiveToMuscleObjective(Objective.FORCE)).toBe(MuscleObjective.FORCE);
  });
  it('HYPERTROPHIE → HYPERTROPHIE', () => {
    expect(objectiveToMuscleObjective(Objective.HYPERTROPHIE)).toBe(MuscleObjective.HYPERTROPHIE);
  });
  it('ENDURANCE → ENDURANCE', () => {
    expect(objectiveToMuscleObjective(Objective.ENDURANCE)).toBe(MuscleObjective.ENDURANCE);
  });
});

// =============================================================================
// 3. MuscleGoal — création, statuts, rangs
// =============================================================================

describe('MuscleGoal', () => {
  it('PRIORITAIRE avec rank explicite', () => {
    const g = makeMuscleGoal({
      muscle: 'pectoraux',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 1,
    });
    expect(g.muscle).toBe('pectoraux');
    expect(g.objective).toBe(MuscleObjective.HYPERTROPHIE);
    expect(g.status).toBe(MuscleStatus.PRIORITAIRE);
    expect(g.priority_rank).toBe(1);
  });

  it('SUGGERE prend rank 99 par défaut (cf. 09 §2.2)', () => {
    const g = makeMuscleGoal({
      muscle: 'abdos',
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.SUGGERE,
    });
    expect(g.priority_rank).toBe(99);
  });
});

// =============================================================================
// 4. PlannedExercise / DayTemplate / WeeklyTemplate
// =============================================================================

describe('PlannedExercise', () => {
  it('progression a 5 entrées : [w1, w2, w3, w4, w5_deload]', () => {
    const p = makePlannedExercise({
      exercise_id: 'bench_bb',
      base_sets: 3,
      progression: [3, 4, 5, 5, 2],
    });
    expect(p.progression).toHaveLength(5);
    expect(p.progression[4]).toBeLessThan(p.progression[3]!);
  });

  it('optionnels par défaut à null', () => {
    const p = makePlannedExercise({
      exercise_id: 'bench_bb',
      base_sets: 3,
      progression: [3, 4, 5, 5, 2],
    });
    expect(p.role).toBeNull();
    expect(p.intensity_scheme).toBeNull();
    expect(p.progression_rule).toBeNull();
  });
});

describe('WeeklyTemplate', () => {
  it('sessions_planned = 5 semaines × n_jours', () => {
    const days = [0, 1, 2, 3].map((i) => ({
      day_index: i,
      label: `Jour ${i + 1}`,
      target_muscles_focus: [] as string[],
      exercises: [],
    }));
    const wt = makeWeeklyTemplate({ cycle_index: 1, rationale: 'U/L 4×', days });
    expect(weeklyTemplateSessionsPlanned(wt)).toBe(20);
  });

  it('warnings vide par défaut', () => {
    const wt = makeWeeklyTemplate({ cycle_index: 1, rationale: 'test' });
    expect(wt.warnings).toEqual([]);
  });
});

// =============================================================================
// 5. CanonicalExercise / GuidedProgram (création minimale)
// =============================================================================

describe('CanonicalExercise', () => {
  it('is_replaceable = true par défaut', () => {
    const ce = makeCanonicalExercise({
      role: 'main_squat',
      preferred_id: 'back_squat_high_bar',
      fallback_subst: ['back_squat_low_bar', 'smith_squat'],
      sets: 5,
      reps_scheme: '5x5',
      intensity_scheme: 'linear_+2.5kg',
    });
    expect(ce.is_replaceable).toBe(true);
  });

  it('ProgressionRule expose la règle du moteur custom', () => {
    // Bloc O — seul ISRAETEL_VOLUME subsiste (règles d'auteur retirées).
    expect(ProgressionRule.ISRAETEL_VOLUME).toBe('israetel_volume');
  });
});

// =============================================================================
// 6. CycleReview
// =============================================================================

describe('CycleReview', () => {
  it('warnings vide par défaut', () => {
    const rev = makeCycleReview({
      cycle_index: 1,
      plafonds_progression: { bench_bb: 5.0 },
      muscles_progresses: ['pectoraux'],
      muscles_plateau: [],
      muscles_undertrained: [],
      muscles_overshoot: [],
      adherence_pct: 0.9,
      volume_total_kg: 12345.0,
      PRs: [['bench_bb', 100.0]],
      suggested_action: SuggestedAction.CONTINUER_PAREIL,
    });
    expect(rev.suggested_action).toBe(SuggestedAction.CONTINUER_PAREIL);
    expect(rev.warnings).toEqual([]);
  });
});

// =============================================================================
// 7. EquipmentOverride
// =============================================================================

describe('EquipmentOverride', () => {
  it('par défaut, tous les champs sont null', () => {
    const eo = makeEquipmentOverride();
    expect(eo.inc_kg).toBeNull();
    expect(eo.min_load_kg).toBeNull();
    expect(eo.max_load_kg).toBeNull();
  });

  it("override partiel : seul l'incrément est fixé", () => {
    const eo = makeEquipmentOverride({ inc_kg: 5.0 });
    expect(eo.inc_kg).toBe(5.0);
    expect(eo.min_load_kg).toBeNull();
  });
});

// =============================================================================
// 8. UserState — extension rétrocompatible
// =============================================================================

function buildProfile() {
  return makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: 80,
  });
}

describe('UserState', () => {
  it('construction minimale rétrocompat (sans muscle_goals)', () => {
    const state = makeUserState(buildProfile());
    expect(state.muscle_goals).toEqual({});
    expect(state.current_cycle_plan).toBeNull();
    expect(state.active_guided_program_id).toBeNull();
    expect(state.recovery_mode).toBe(false);
    expect(state.recovery_weeks_remaining).toBe(0);
    expect(state.equipment_overrides).toEqual({});
  });

  it('peut accueillir un MuscleGoal après construction', () => {
    const state = makeUserState(buildProfile());
    state.muscle_goals['pectoraux'] = makeMuscleGoal({
      muscle: 'pectoraux',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 1,
    });
    expect(state.muscle_goals['pectoraux']!.priority_rank).toBe(1);
  });

  it('mode recovery activable', () => {
    const state = makeUserState(buildProfile());
    state.recovery_mode = true;
    state.recovery_weeks_remaining = 2;
    expect(state.recovery_mode).toBe(true);
    expect(state.recovery_weeks_remaining).toBe(2);
  });

  it('equipment_overrides indexable par exo', () => {
    const state = makeUserState(buildProfile());
    state.equipment_overrides['leg_press'] = makeEquipmentOverride({ inc_kg: 5.0 });
    expect(state.equipment_overrides['leg_press']!.inc_kg).toBe(5.0);
  });
});

// =============================================================================
// 9. Profile — invariants (port de Profile.__post_init__)
// =============================================================================

describe('makeProfile — validation', () => {
  it('âge < 14 lève', () => {
    expect(() =>
      makeProfile({
        sex: Sex.HOMME,
        age: 13,
        level: Level.DEBUTANT,
        objective: Objective.HYPERTROPHIE,
        sessions_per_week: 3,
        bodyweight_kg: 70,
      }),
    ).toThrow(/Âge/);
  });

  it('âge > 100 lève', () => {
    expect(() =>
      makeProfile({
        sex: Sex.HOMME,
        age: 101,
        level: Level.DEBUTANT,
        objective: Objective.HYPERTROPHIE,
        sessions_per_week: 3,
        bodyweight_kg: 70,
      }),
    ).toThrow(/Âge/);
  });

  it('séances/sem < 2 lève', () => {
    expect(() =>
      makeProfile({
        sex: Sex.FEMME,
        age: 30,
        level: Level.INTERMEDIAIRE,
        objective: Objective.FORCE,
        sessions_per_week: 1,
        bodyweight_kg: 60,
      }),
    ).toThrow(/Séances/);
  });

  it('séances/sem > 6 lève', () => {
    expect(() =>
      makeProfile({
        sex: Sex.FEMME,
        age: 30,
        level: Level.INTERMEDIAIRE,
        objective: Objective.FORCE,
        sessions_per_week: 7,
        bodyweight_kg: 60,
      }),
    ).toThrow(/Séances/);
  });

  it('bodyweight ≤ 0 lève', () => {
    expect(() =>
      makeProfile({
        sex: Sex.HOMME,
        age: 30,
        level: Level.INTERMEDIAIRE,
        objective: Objective.HYPERTROPHIE,
        sessions_per_week: 4,
        bodyweight_kg: 0,
      }),
    ).toThrow(/Poids/);
  });

  it('available_equip est bien un Set après construction', () => {
    const p = makeProfile({
      sex: Sex.HOMME,
      age: 30,
      level: Level.INTERMEDIAIRE,
      objective: Objective.HYPERTROPHIE,
      sessions_per_week: 4,
      bodyweight_kg: 80,
      available_equip: ['bb_oly', 'rack'],
    });
    expect(p.available_equip).toBeInstanceOf(Set);
    expect(p.available_equip.has('bb_oly')).toBe(true);
  });
});

// =============================================================================
// 10. Exercise — from_dict + helpers primaires/synergistes
// =============================================================================

const DICT_BENCH: ExerciseDict = {
  id: 'bench_bb',
  nom_fr: 'Développé couché à la barre',
  pattern: 'push_h',
  type: 'compound',
  charge: 'barbell',
  equip: ['bb_oly', 'bench_flat', 'rack'],
  uni: false,
  muscles: { pectoraux: 1.0, triceps: 0.5, deltos_anterieurs: 0.5 },
  subst: 'bench_h_bb',
  inc_kg: 2.5,
  reps_hyp: [6, 10],
  reps_force: [3, 5],
  repos_s: 180,
  dif: 'élevé',
  e1RM_app: 'full',
  tags: [],
};

describe('exerciseFromDict', () => {
  it('parse correctement un exo standard', () => {
    const ex = exerciseFromDict(DICT_BENCH);
    expect(ex.id).toBe('bench_bb');
    expect(ex.pattern).toBe(Pattern.PUSH_H);
    expect(ex.type).toBe(ExType.COMPOUND);
    expect(ex.charge).toBe(ChargeType.BARBELL);
    expect(ex.e1RM_app).toBe(E1RMApp.FULL);
    expect(ex.equip).toEqual(['bb_oly', 'bench_flat', 'rack']);
    expect(ex.reps_hyp).toEqual([6, 10]);
    expect(ex.reps_force).toEqual([3, 5]);
    expect(ex.tags).toEqual([]);
    expect(ex.synonymes).toEqual([]);
    expect(ex.note).toBe('');
  });

  it('reps_force absent → null', () => {
    const dict: ExerciseDict = { ...DICT_BENCH, id: 'iso_x', reps_force: null };
    const ex = exerciseFromDict(dict);
    expect(ex.reps_force).toBeNull();
  });

  it('lève si reps_hyp mal formé', () => {
    const dict = { ...DICT_BENCH, reps_hyp: [6] as number[] };
    expect(() => exerciseFromDict(dict)).toThrow(/reps_hyp/);
  });
});

describe('helpers Exercise', () => {
  const ex = exerciseFromDict(DICT_BENCH);

  it('primaires = muscles avec coef ≥ 1.0', () => {
    expect(exercisePrimaires(ex)).toEqual(['pectoraux']);
  });

  it('synergistes = muscles avec 0 < coef < 1.0', () => {
    expect(new Set(exerciseSynergistes(ex))).toEqual(new Set(['triceps', 'deltos_anterieurs']));
  });
});
