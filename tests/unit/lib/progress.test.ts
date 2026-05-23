/**
 * Tests purs sur `src/lib/progress.ts` — sélecteurs de l'onglet Progrès.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCycleHistory,
  buildMusclesOf,
  computeCoverageThisWeek,
  computeE1rmHistory,
  computeVolumeHistory,
  exerciseLabel,
  formatCycleDates,
  formatWeekLabel,
  muscleLabel,
  type MuscleCoverage,
  type MuscleVolumeSeries,
} from '@/lib/progress';
import { Catalog } from '@/engine/catalog';
import type { CycleRow, FeedbackRow } from '@/db/schema';
import type {
  Exercise,
  GuidedProgram,
  CycleReview,
  SessionFeedback,
  UserState,
  Level,
} from '@/engine/models';
import {
  ChargeType,
  E1RMApp,
  ExType,
  MuscleObjective,
  MuscleStatus,
  Pattern,
  ProgressionRule,
  Sex,
  SuggestedAction,
  exerciseFromDict,
} from '@/engine/models';

// =============================================================================
// Fixtures
// =============================================================================

function makeExercise(
  id: string,
  muscles: Record<string, number>,
): Exercise {
  return exerciseFromDict({
    id,
    nom_fr: `Exo ${id}`,
    pattern: Pattern.PUSH_H,
    type: ExType.COMPOUND,
    charge: ChargeType.BARBELL,
    equip: [],
    uni: false,
    muscles,
    subst: id,
    inc_kg: 2.5,
    reps_hyp: [8, 12],
    reps_force: [3, 5],
    repos_s: 120,
    dif: 'mod',
    e1RM_app: E1RMApp.FULL,
    tags: [],
    note: '',
    synonymes: [],
  });
}

function makeCatalog(): Catalog {
  return new Catalog([
    makeExercise('bp', { pectoraux: 1.0, triceps: 0.5, deltos_lateraux: 0.5 }),
    makeExercise('squat', { quadriceps: 1.0, fessiers: 0.5 }),
    makeExercise('curl', { biceps: 1.0 }),
  ]);
}

function makeState(overrides: Partial<UserState> = {}): UserState {
  return {
    profile: {
      sex: Sex.HOMME,
      age: 30,
      level: 'intermediaire' as Level,
      objective: 'hypertrophie',
      sessions_per_week: 4,
      bodyweight_kg: 75,
      available_equip: new Set(),
    } as UserState['profile'],
    e1rm: {},
    k_user: {},
    reps_pr: {},
    volume_min: { pectoraux: 10, biceps: 8, quadriceps: 10 },
    volume_max: { pectoraux: 18, biceps: 14, quadriceps: 18 },
    current_week_in_cycle: 2,
    cycle_index: 1,
    plateau_counter: {},
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {
      pectoraux: {
        muscle: 'pectoraux',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 1,
      },
      biceps: {
        muscle: 'biceps',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 2,
      },
      quadriceps: {
        muscle: 'quadriceps',
        objective: MuscleObjective.HYPERTROPHIE,
        status: MuscleStatus.PRIORITAIRE,
        priority_rank: 3,
      },
    },
    current_cycle_plan: null,
    active_guided_program_id: null,
    recovery_mode: false,
    recovery_weeks_remaining: 0,
    equipment_overrides: {},
    weekly_volume_debt: {},
    fixed_routine: {},
    ...overrides,
  };
}

function makeFb(
  seanceDate: string,
  sets: Array<{ exercise_id: string; n: number }>,
): FeedbackRow {
  const fbSets: SessionFeedback['sets'] = [];
  for (const { exercise_id, n } of sets) {
    for (let i = 0; i < n; i++) {
      fbSets.push({
        exercise_id,
        reps_done: 8,
        load_kg: 50,
        rpe_perceived: 8,
      });
    }
  }
  return {
    seance_date: seanceDate,
    cycle_index: 1,
    week_in_cycle: 1,
    session_id: null,
    feedback: {
      seance_date: seanceDate,
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 8,
      sets: fbSets,
      label: 'Test',
    },
    created_at: seanceDate,
  };
}

function makeCycleRow(
  cycleIndex: number,
  startDate: string,
  endDate: string | null,
  programmeId: string | null,
  review: CycleReview | null,
): CycleRow {
  return { cycle_index: cycleIndex, start_date: startDate, end_date: endDate, programme_id: programmeId, review };
}

function makeReview(input: {
  cycle_index: number;
  plafonds: Record<string, number>;
  volume_total_kg: number;
}): CycleReview {
  return {
    cycle_index: input.cycle_index,
    plafonds_progression: input.plafonds,
    muscles_progresses: [],
    muscles_plateau: [],
    muscles_undertrained: [],
    muscles_overshoot: [],
    adherence_pct: 1,
    volume_total_kg: input.volume_total_kg,
    PRs: [],
    suggested_action: SuggestedAction.CONTINUER_PAREIL,
    warnings: [],
  };
}

// =============================================================================
// buildMusclesOf
// =============================================================================

describe('buildMusclesOf', () => {
  it('extrait les muscles de chaque exo', () => {
    const cat = makeCatalog();
    const m = buildMusclesOf(cat);
    expect(m['bp']).toEqual({ pectoraux: 1.0, triceps: 0.5, deltos_lateraux: 0.5 });
    expect(m['squat']).toEqual({ quadriceps: 1.0, fessiers: 0.5 });
  });
});

// =============================================================================
// computeCoverageThisWeek
// =============================================================================

describe('computeCoverageThisWeek', () => {
  // 2026-05-13 = mercredi → lundi 2026-05-11.
  const NOW = new Date(2026, 4, 13);
  const cat = makeCatalog();
  const musclesOf = buildMusclesOf(cat);

  it('marque non_travaille les muscles sans feedback cette semaine', () => {
    const state = makeState();
    const cov = computeCoverageThisWeek(state, [], musclesOf, NOW);
    const byMuscle = new Map(cov.map((c) => [c.muscle, c]));
    expect(byMuscle.get('pectoraux')?.status).toBe('non_travaille');
    expect(byMuscle.get('biceps')?.status).toBe('non_travaille');
  });

  it('compte les feedbacks de la semaine courante uniquement', () => {
    const state = makeState();
    const cov = computeCoverageThisWeek(
      state,
      [
        // Semaine en cours (lun 11 → dim 17 mai) : 4 séries de bp = 4 × 1 = 4 pecs.
        makeFb('2026-05-12', [{ exercise_id: 'bp', n: 4 }]),
        // Semaine d'avant : ne doit pas être comptée.
        makeFb('2026-05-04', [{ exercise_id: 'bp', n: 8 }]),
      ],
      musclesOf,
      NOW,
    );
    const pec = cov.find((c) => c.muscle === 'pectoraux');
    expect(pec?.sets).toBe(4);
    expect(pec?.status).toBe('sous_min'); // 4 < V_min=10
  });

  it('passe à ok quand le volume atteint V_min', () => {
    const state = makeState();
    const cov = computeCoverageThisWeek(
      state,
      [makeFb('2026-05-13', [{ exercise_id: 'bp', n: 12 }])],
      musclesOf,
      NOW,
    );
    const pec = cov.find((c) => c.muscle === 'pectoraux');
    expect(pec?.sets).toBe(12); // 12 × 1.0
    expect(pec?.status).toBe('ok'); // 10 ≤ 12 ≤ 18
  });

  it('passe à depassement au-delà de V_max', () => {
    const state = makeState();
    const cov = computeCoverageThisWeek(
      state,
      [makeFb('2026-05-13', [{ exercise_id: 'bp', n: 25 }])],
      musclesOf,
      NOW,
    );
    const pec = cov.find((c) => c.muscle === 'pectoraux');
    expect(pec?.status).toBe('depassement');
  });

  it("marque hors_scope les muscles avec V_min=0 (NON_COUVERT)", () => {
    const state = makeState({
      volume_min: { pectoraux: 10, mollets: 6 },
      volume_max: { pectoraux: 18, mollets: 12 },
      muscle_goals: {
        pectoraux: {
          muscle: 'pectoraux',
          objective: MuscleObjective.HYPERTROPHIE,
          status: MuscleStatus.PRIORITAIRE,
          priority_rank: 1,
        },
        mollets: {
          muscle: 'mollets',
          objective: MuscleObjective.HYPERTROPHIE,
          status: MuscleStatus.NON_COUVERT,
          priority_rank: 99,
        },
      },
    });
    const cov = computeCoverageThisWeek(state, [], musclesOf, NOW);
    const m = cov.find((c) => c.muscle === 'mollets');
    expect(m?.status).toBe('hors_scope');
  });

  it("intensity reste clampée à [0, 1]", () => {
    const state = makeState();
    const cov = computeCoverageThisWeek(
      state,
      [makeFb('2026-05-13', [{ exercise_id: 'bp', n: 100 }])],
      musclesOf,
      NOW,
    );
    for (const c of cov) {
      expect(c.intensity).toBeGreaterThanOrEqual(0);
      expect(c.intensity).toBeLessThanOrEqual(1);
    }
  });
});

// =============================================================================
// computeVolumeHistory
// =============================================================================

describe('computeVolumeHistory', () => {
  const NOW = new Date(2026, 4, 13); // mer 13 mai
  const cat = makeCatalog();
  const musclesOf = buildMusclesOf(cat);

  it('renvoie une série par muscle du profil, ordonnée alpha', () => {
    const state = makeState();
    const series = computeVolumeHistory(state, [], musclesOf, 4, NOW);
    expect(series.map((s) => s.muscle)).toEqual(['biceps', 'pectoraux', 'quadriceps']);
  });

  it('chaque série a `weeks` points, ordre ancien → récent', () => {
    const state = makeState();
    const series = computeVolumeHistory(state, [], musclesOf, 4, NOW);
    const pec = series.find((s) => s.muscle === 'pectoraux')!;
    expect(pec.points).toHaveLength(4);
    expect(pec.points[0]!.weekStart).toBe('2026-04-20');
    expect(pec.points[3]!.weekStart).toBe('2026-05-11');
  });

  it('agrège les feedbacks par semaine et par muscle', () => {
    const state = makeState();
    const series = computeVolumeHistory(
      state,
      [
        makeFb('2026-05-12', [{ exercise_id: 'bp', n: 6 }]), // semaine courante
        makeFb('2026-05-13', [{ exercise_id: 'curl', n: 4 }]),
        makeFb('2026-05-04', [{ exercise_id: 'bp', n: 3 }]), // semaine -1
      ],
      musclesOf,
      4,
      NOW,
    );
    const pec = series.find((s) => s.muscle === 'pectoraux')!;
    expect(pec.points[3]!.sets).toBe(6);
    expect(pec.points[2]!.sets).toBe(3);
    const bi = series.find((s) => s.muscle === 'biceps')!;
    expect(bi.points[3]!.sets).toBe(4);
  });

  it('vMin / vMax sont ceux du profil (effectiveVolumeBounds)', () => {
    const state = makeState();
    const series: MuscleVolumeSeries[] = computeVolumeHistory(
      state,
      [],
      musclesOf,
      2,
      NOW,
    );
    const pec = series.find((s) => s.muscle === 'pectoraux')!;
    // factor HYPERTROPHIE = 1.0 → bornes inchangées.
    expect(pec.vMin).toBe(10);
    expect(pec.vMax).toBe(18);
  });
});

// =============================================================================
// buildCycleHistory
// =============================================================================

describe('buildCycleHistory', () => {
  const fakeProgram = {
    id: 'ss',
    name: 'Starting Strength',
    author: '',
    source: '',
    sessions_per_week: 3,
    public_cible: [],
    objectifs_principaux: [],
    cycle_length_weeks: 4,
    days: [],
    progression_rule: ProgressionRule.LINEAR_2_5KG,
    notes: '',
  } as unknown as GuidedProgram;

  it('ignore les cycles sans review', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(1, '2026-04-01', '2026-05-01', 'ss', null),
        makeCycleRow(
          2,
          '2026-05-02',
          '2026-06-01',
          'ss',
          makeReview({ cycle_index: 2, plafonds: { bp: 5 }, volume_total_kg: 10000 }),
        ),
      ],
      [fakeProgram],
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.cycleIndex).toBe(2);
  });

  it('renvoie les cycles du plus récent au plus ancien', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          'ss',
          makeReview({ cycle_index: 1, plafonds: { bp: 3 }, volume_total_kg: 8000 }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          'ss',
          makeReview({ cycle_index: 2, plafonds: { bp: 5 }, volume_total_kg: 11000 }),
        ),
      ],
      [fakeProgram],
    );
    expect(items.map((i) => i.cycleIndex)).toEqual([2, 1]);
  });

  it('résout le nom du programme depuis programme_id', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          'ss',
          makeReview({ cycle_index: 1, plafonds: {}, volume_total_kg: 0 }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          'inconnu',
          makeReview({ cycle_index: 2, plafonds: {}, volume_total_kg: 0 }),
        ),
      ],
      [fakeProgram],
    );
    const byIdx = new Map(items.map((i) => [i.cycleIndex, i]));
    expect(byIdx.get(1)?.programName).toBe('Starting Strength');
    expect(byIdx.get(2)?.programName).toBeNull();
  });

  it('classe et tronque les plafonds (top 3 décroissants)', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          'ss',
          makeReview({
            cycle_index: 1,
            plafonds: { a: 3, b: 7, c: 1, d: 12, e: 5 },
            volume_total_kg: 0,
          }),
        ),
      ],
      [fakeProgram],
    );
    expect(items[0]!.plafondsTop.map(([, k]) => k)).toEqual([12, 7, 5]);
  });

  it('calcule delta volume et delta top plafond vs cycle précédent', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          'ss',
          makeReview({ cycle_index: 1, plafonds: { bp: 5 }, volume_total_kg: 8000 }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          'ss',
          makeReview({ cycle_index: 2, plafonds: { bp: 8 }, volume_total_kg: 11000 }),
        ),
      ],
      [fakeProgram],
    );
    const latest = items[0]!;
    expect(latest.deltaVolumeKg).toBe(3000);
    expect(latest.deltaTopPlafondKg).toBe(3);
    const oldest = items[1]!;
    expect(oldest.deltaVolumeKg).toBeNull();
    expect(oldest.deltaTopPlafondKg).toBeNull();
  });
});

// =============================================================================
// Helpers de formatage
// =============================================================================

// =============================================================================
// computeE1rmHistory (Conv #11g)
// =============================================================================

function makeFbCustom(
  seanceDate: string,
  sets: Array<{ exercise_id: string; reps_done: number; load_kg: number; rpe_perceived: number }>,
): FeedbackRow {
  return {
    seance_date: seanceDate,
    cycle_index: 1,
    week_in_cycle: 1,
    session_id: null,
    feedback: {
      seance_date: seanceDate,
      week_in_cycle: 1,
      cycle_index: 1,
      rpe_target: 8,
      sets,
      label: 'Test',
    },
    created_at: seanceDate,
  };
}

describe('computeE1rmHistory', () => {
  const cat = makeCatalog();

  it("ne renvoie pas un exo avec un seul point (pas de courbe possible)", () => {
    const fbs = [
      makeFbCustom('2026-05-01', [
        { exercise_id: 'bp', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
      ]),
    ];
    expect(computeE1rmHistory(fbs, cat)).toEqual([]);
  });

  it('garde le max e1rm par date et trie chronologiquement', () => {
    const fbs = [
      makeFbCustom('2026-05-08', [
        // 2 sets ce jour-là : on garde celui qui donne le e1rm le plus haut
        { exercise_id: 'bp', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
        { exercise_id: 'bp', reps_done: 3, load_kg: 90, rpe_perceived: 8 },
      ]),
      makeFbCustom('2026-05-01', [
        { exercise_id: 'bp', reps_done: 5, load_kg: 75, rpe_perceived: 8 },
      ]),
    ];
    const series = computeE1rmHistory(fbs, cat);
    expect(series).toHaveLength(1);
    expect(series[0]!.exercise_id).toBe('bp');
    expect(series[0]!.points).toHaveLength(2);
    expect(series[0]!.points[0]!.date).toBe('2026-05-01');
    expect(series[0]!.points[1]!.date).toBe('2026-05-08');
    expect(series[0]!.current).toBeGreaterThan(series[0]!.initial);
    expect(series[0]!.deltaPct).toBeGreaterThan(0);
  });

  it('exclut les sets invalides (reps <= 0, e1rm calcul échoue)', () => {
    const fbs = [
      makeFbCustom('2026-05-01', [
        { exercise_id: 'bp', reps_done: 0, load_kg: 80, rpe_perceived: 8 }, // skip
        { exercise_id: 'bp', reps_done: 5, load_kg: 80, rpe_perceived: 8 },
      ]),
      makeFbCustom('2026-05-08', [
        { exercise_id: 'bp', reps_done: 5, load_kg: 85, rpe_perceived: 8 },
      ]),
    ];
    const series = computeE1rmHistory(fbs, cat);
    expect(series).toHaveLength(1);
    expect(series[0]!.points).toHaveLength(2);
  });

  it('ignore les exos absents du catalogue', () => {
    const fbs = [
      makeFbCustom('2026-05-01', [
        { exercise_id: 'inconnu', reps_done: 5, load_kg: 50, rpe_perceived: 8 },
      ]),
      makeFbCustom('2026-05-08', [
        { exercise_id: 'inconnu', reps_done: 5, load_kg: 55, rpe_perceived: 8 },
      ]),
    ];
    expect(computeE1rmHistory(fbs, cat)).toEqual([]);
  });
});

describe('helpers formatage', () => {
  it('muscleLabel : capitalise sans article, dictionnaire FR (Conv #14c-8)', () => {
    expect(muscleLabel('deltos_lateraux')).toBe('Deltoïdes latéraux');
    expect(muscleLabel('pectoraux')).toBe('Pectoraux');
    expect(muscleLabel('dos_largeur')).toBe('Dos en largeur');
    expect(muscleLabel('ischios')).toBe('Ischio-jambiers');
    // Fallback : muscle inconnu → Capitalize naïf.
    expect(muscleLabel('foo_bar')).toBe('Foo Bar');
  });

  it('formatCycleDates : avec fin = plage, sans fin = "depuis le X"', () => {
    expect(formatCycleDates('2026-04-12', '2026-05-17')).toContain('avr');
    expect(formatCycleDates('2026-04-12', null)).toContain('depuis');
  });

  it('formatWeekLabel : restitue la date FR courte', () => {
    expect(formatWeekLabel('2026-05-11')).toMatch(/mai/);
  });

  it('exerciseLabel : nom_fr du catalogue, fallback id', () => {
    const cat = makeCatalog();
    expect(exerciseLabel('bp', cat)).toBe('Exo bp');
    expect(exerciseLabel('inconnu', cat)).toBe('inconnu');
    expect(exerciseLabel('bp', null)).toBe('bp');
  });
});

// =============================================================================
// Smoke type-check
// =============================================================================

describe('types', () => {
  it("MuscleCoverage est exporté avec la bonne forme", () => {
    const x: MuscleCoverage = {
      muscle: 'x',
      sets: 0,
      vMin: 0,
      vMax: 0,
      status: 'hors_scope',
      intensity: 0,
    };
    expect(x.status).toBe('hors_scope');
  });
});
