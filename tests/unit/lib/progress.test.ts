/**
 * Tests purs sur `src/lib/progress.ts` — sélecteurs de l'onglet Progrès.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCycleHistory,
  buildMusclesOf,
  computeCoverageThisWeek,
  computeCycleVolumeByMuscle,
  computeE1rmSeriesFromSnapshots,
  computeLastWorkedByMuscle,
  computeVolumeHistory,
  weeksSinceFirstFeedback,
  exerciseLabel,
  formatCycleDates,
  formatWeekLabel,
  muscleLabel,
  type MuscleCoverage,
  type MuscleVolumeSeries,
} from '@/lib/progress';
import { Catalog } from '@/engine/catalog';
import type { CycleRow, E1rmSnapshotRow, FeedbackRow } from '@/db/schema';
import type {
  Exercise,
  CycleReview,
  SessionFeedback,
  UserState,
  Level,
} from '@/engine/models';
import {
  ChargeType,
  ExType,
  MuscleObjective,
  MuscleStatus,
  Pattern,
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
  charge: ChargeType = ChargeType.BARBELL,
): Exercise {
  return exerciseFromDict({
    id,
    nom_fr: `Exo ${id}`,
    pattern: Pattern.PUSH_H,
    type: ExType.COMPOUND,
    charge,
    equip: [],
    uni: false,
    muscles,
    subst: id,
    inc_kg: 2.5,
    reps_hyp: [8, 12],
    reps_force: [3, 5],
    repos_s: 120,
    dif: 'mod',
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
    volume_min: { pectoraux: 10, biceps: 8, quadriceps: 10 },
    volume_max: { pectoraux: 18, biceps: 14, quadriceps: 18 },
    current_week_in_cycle: 2,
    cycle_index: 1,
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
    equipment_overrides: {},
    prescribed_load_floor: {},
    prescribed_reps_floor: {},
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
  review: CycleReview | null,
): CycleRow {
  return { cycle_index: cycleIndex, start_date: startDate, end_date: endDate, review };
}

function makeReview(input: {
  cycle_index: number;
  plafonds: Record<string, number>;
  volume_total_kg: number;
  muscle_goals_snapshot?: CycleReview['muscle_goals_snapshot'];
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
    ...(input.muscle_goals_snapshot !== undefined
      ? { muscle_goals_snapshot: input.muscle_goals_snapshot }
      : {}),
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
  it('ignore les cycles sans review', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(1, '2026-04-01', '2026-05-01', null),
        makeCycleRow(
          2,
          '2026-05-02',
          '2026-06-01',
          makeReview({ cycle_index: 2, plafonds: { bp: 5 }, volume_total_kg: 10000 }),
        ),
      ],
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
          makeReview({ cycle_index: 1, plafonds: { bp: 3 }, volume_total_kg: 8000 }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          makeReview({ cycle_index: 2, plafonds: { bp: 5 }, volume_total_kg: 11000 }),
        ),
      ],
    );
    expect(items.map((i) => i.cycleIndex)).toEqual([2, 1]);
  });

  it('classe et tronque les plafonds (top 3 décroissants)', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          makeReview({
            cycle_index: 1,
            plafonds: { a: 3, b: 7, c: 1, d: 12, e: 5 },
            volume_total_kg: 0,
          }),
        ),
      ],
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
          makeReview({ cycle_index: 1, plafonds: { bp: 5 }, volume_total_kg: 8000 }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          makeReview({ cycle_index: 2, plafonds: { bp: 8 }, volume_total_kg: 11000 }),
        ),
      ],
    );
    const latest = items[0]!;
    expect(latest.deltaVolumeKg).toBe(3000);
    expect(latest.deltaTopPlafondKg).toBe(3);
    const oldest = items[1]!;
    expect(oldest.deltaVolumeKg).toBeNull();
    expect(oldest.deltaTopPlafondKg).toBeNull();
  });

  it('objectivesByMuscle : un muscle PRIORITAIRE (rank 1) précède un non-prioritaire alphabétiquement antérieur', () => {
    // 'abducteurs' passe avant 'pectoraux' en alphabétique, mais 'pectoraux'
    // est PRIORITAIRE (rank 1) → il doit remonter en tête. Le statut du snapshot
    // vaut l'enum minuscule ('prioritaire'), d'où le bug historique du littéral
    // majuscule qui laissait tomber le tri sur l'ordre alphabétique.
    const items = buildCycleHistory([
      makeCycleRow(
        1,
        '2026-03-01',
        '2026-04-01',
        makeReview({
          cycle_index: 1,
          plafonds: { bp: 5 },
          volume_total_kg: 8000,
          muscle_goals_snapshot: [
            {
              muscle: 'abducteurs',
              objective: MuscleObjective.HYPERTROPHIE,
              status: MuscleStatus.SUGGERE,
              priority_rank: 99,
            },
            {
              muscle: 'pectoraux',
              objective: MuscleObjective.HYPERTROPHIE,
              status: MuscleStatus.PRIORITAIRE,
              priority_rank: 1,
            },
          ],
        }),
      ),
    ]);
    const obj = items[0]!.objectivesByMuscle!;
    expect(obj.map((o) => o.muscle)).toEqual(['pectoraux', 'abducteurs']);
  });

  it('objectivesByMuscle : plusieurs PRIORITAIRES sont triés par priorityRank croissant', () => {
    const items = buildCycleHistory([
      makeCycleRow(
        1,
        '2026-03-01',
        '2026-04-01',
        makeReview({
          cycle_index: 1,
          plafonds: { bp: 5 },
          volume_total_kg: 8000,
          muscle_goals_snapshot: [
            {
              muscle: 'dos',
              objective: MuscleObjective.HYPERTROPHIE,
              status: MuscleStatus.PRIORITAIRE,
              priority_rank: 2,
            },
            {
              muscle: 'jambes',
              objective: MuscleObjective.HYPERTROPHIE,
              status: MuscleStatus.PRIORITAIRE,
              priority_rank: 1,
            },
          ],
        }),
      ),
    ]);
    const obj = items[0]!.objectivesByMuscle!;
    expect(obj.map((o) => o.muscle)).toEqual(['jambes', 'dos']);
  });
});

// =============================================================================
// computeE1rmSeriesFromSnapshots (#63 — courbe Force basée sur les snapshots
// e1RM = plafond EMA du bilan, pas un recalcul Epley brut)
// =============================================================================

function snap(
  date: string,
  exercise_id: string,
  e1rm: number,
  week_in_cycle = 1,
): E1rmSnapshotRow {
  return { date, exercise_id, e1rm, cycle_index: 1, week_in_cycle };
}

describe('computeE1rmSeriesFromSnapshots', () => {
  const cat = makeCatalog();

  it('ne renvoie pas un exo avec un seul snapshot (pas de courbe)', () => {
    expect(computeE1rmSeriesFromSnapshots([snap('2026-05-01', 'bp', 100)], cat)).toEqual([]);
  });

  it('trace le plafond persisté tel quel (float, sans arrondi) — baisse suivie', () => {
    const snaps = [
      snap('2026-05-01', 'bp', 100.4),
      snap('2026-05-08', 'bp', 98.7), // le plafond EMA a BAISSÉ → la courbe suit
    ];
    const series = computeE1rmSeriesFromSnapshots(snaps, cat);
    expect(series).toHaveLength(1);
    expect(series[0]!.points.map((p) => p.e1rm)).toEqual([100.4, 98.7]);
    expect(series[0]!.initial).toBe(100.4);
    expect(series[0]!.current).toBe(98.7);
    expect(series[0]!.deltaPct).toBeLessThan(0);
  });

  it('trie chronologiquement et garde le dernier snapshot par date', () => {
    const snaps = [
      snap('2026-05-08', 'bp', 102),
      snap('2026-05-01', 'bp', 100),
      snap('2026-05-08', 'bp', 105), // même date, plus récent → fait foi
    ];
    const series = computeE1rmSeriesFromSnapshots(snaps, cat);
    expect(series[0]!.points).toHaveLength(2);
    expect(series[0]!.points[0]).toEqual({ date: '2026-05-01', e1rm: 100 });
    expect(series[0]!.points[1]).toEqual({ date: '2026-05-08', e1rm: 105 });
  });

  it('ignore les exos absents du catalogue', () => {
    const snaps = [snap('2026-05-01', 'inconnu', 50), snap('2026-05-08', 'inconnu', 55)];
    expect(computeE1rmSeriesFromSnapshots(snaps, cat)).toEqual([]);
  });

  // B-1/B-2 (dump 2.2.0)
  it('trie par dernière mesure la plus récente, pas par nombre de points', () => {
    const snaps = [
      // 4 points mais mesuré pour la dernière fois il y a longtemps.
      snap('2026-04-01', 'bp', 100),
      snap('2026-04-08', 'bp', 101),
      snap('2026-04-15', 'bp', 102),
      snap('2026-04-22', 'bp', 103),
      // 2 points seulement mais travaillé cette semaine.
      snap('2026-05-20', 'curl', 30),
      snap('2026-05-27', 'curl', 32),
    ];
    const series = computeE1rmSeriesFromSnapshots(snaps, cat);
    expect(series.map((s) => s.exercise_id)).toEqual(['curl', 'bp']);
  });

  it('ne tronque plus la liste (feu le topN = 8)', () => {
    const many: Exercise[] = [];
    const snaps: E1rmSnapshotRow[] = [];
    for (let i = 0; i < 12; i++) {
      const id = `exo${i}`;
      many.push(makeExercise(id, { pectoraux: 1.0 }));
      snaps.push(snap('2026-05-01', id, 50 + i), snap('2026-05-08', id, 51 + i));
    }
    const series = computeE1rmSeriesFromSnapshots(snaps, new Catalog(many));
    expect(series).toHaveLength(12);
  });
});

// =============================================================================
// computeLastWorkedByMuscle / weeksSinceFirstFeedback (B-1 / B-3 du dump 2.2.0)
// =============================================================================

describe('computeLastWorkedByMuscle', () => {
  const musclesOf = buildMusclesOf(makeCatalog());

  it('retient la date la plus récente par muscle, synergies comprises', () => {
    const fbs = [
      makeFb('2026-05-01', [{ exercise_id: 'bp', n: 3 }]),
      makeFb('2026-05-10', [{ exercise_id: 'squat', n: 3 }]),
      makeFb('2026-05-04', [{ exercise_id: 'bp', n: 2 }]),
    ];
    const last = computeLastWorkedByMuscle(fbs, musclesOf);
    expect(last.pectoraux).toBe('2026-05-04');
    // triceps est synergiste du développé (coef 0,5) → il compte quand même.
    expect(last.triceps).toBe('2026-05-04');
    expect(last.quadriceps).toBe('2026-05-10');
  });

  it('omet les muscles jamais travaillés', () => {
    const last = computeLastWorkedByMuscle(
      [makeFb('2026-05-01', [{ exercise_id: 'curl', n: 3 }])],
      musclesOf,
    );
    expect(last.biceps).toBe('2026-05-01');
    expect(last.pectoraux).toBeUndefined();
  });
});

describe('weeksSinceFirstFeedback', () => {
  it('compte les semaines de la 1re séance à aujourd_hui, incluses', () => {
    const fbs = [
      makeFb('2026-05-04', [{ exercise_id: 'bp', n: 1 }]),
      makeFb('2026-05-18', [{ exercise_id: 'bp', n: 1 }]),
    ];
    // 2026-05-04 = lundi ; NOW dans la semaine du 18 → 3 semaines couvertes.
    expect(weeksSinceFirstFeedback(fbs, new Date('2026-05-20T10:00:00'))).toBe(3);
  });

  it('renvoie 1 sans aucun feedback', () => {
    expect(weeksSinceFirstFeedback([], new Date('2026-05-20T10:00:00'))).toBe(1);
  });
});

describe('helpers formatage', () => {
  it('muscleLabel : capitalise sans article, dictionnaire FR (Conv #14c-8)', () => {
    expect(muscleLabel('deltos_lateraux')).toBe('Deltoïdes latéraux');
    expect(muscleLabel('pectoraux')).toBe('Pectoraux');
    expect(muscleLabel('dos_largeur')).toBe('Grand dorsal');
    expect(muscleLabel('dos_epaisseur')).toBe('Trapèzes / rhomboïdes');
    expect(muscleLabel('deltos_anterieurs')).toBe('Deltoïdes antérieurs');
    expect(muscleLabel('deltos_posterieurs')).toBe('Deltoïdes postérieurs');
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
// computeCycleVolumeByMuscle (Conv #76)
// =============================================================================

describe('computeCycleVolumeByMuscle', () => {
  /** Programme sans jambes : quadriceps retiré des objectifs. */
  function stateSansJambes(): UserState {
    const s = makeState();
    delete s.volume_min['quadriceps'];
    delete s.volume_max['quadriceps'];
    delete s.muscle_goals['quadriceps'];
    return s;
  }

  it('ne liste que les muscles suivis, même si un autre a été travaillé', () => {
    // Du squat fait en séance libre alors que les jambes ne sont pas au
    // programme : sans bande cible, une barre n'aurait aucune référence à
    // montrer. Ce travail se lit sur la silhouette du bilan, pas ici.
    const rows = computeCycleVolumeByMuscle(
      [makeFb('2026-01-05', [{ exercise_id: 'bp', n: 8 }, { exercise_id: 'squat', n: 6 }])],
      1,
      stateSansJambes(),
      buildMusclesOf(makeCatalog()),
    );
    expect(rows.some((r) => r.muscle === 'quadriceps')).toBe(false);
    expect(rows.every((r) => r.vMax > 0)).toBe(true);
  });

  it('un muscle suivi mais non travaillé apparaît à 0', () => {
    const rows = computeCycleVolumeByMuscle(
      [makeFb('2026-01-05', [{ exercise_id: 'bp', n: 4 }])],
      1,
      makeState(),
      buildMusclesOf(makeCatalog()),
    );
    const quads = rows.find((r) => r.muscle === 'quadriceps');
    expect(quads).toBeDefined();
    expect(quads!.avgSetsPerWeek).toBe(0);
    expect(quads!.status).toBe('non_travaille');
  });

  it('les prioritaires sortent en tête, par rang', () => {
    const rows = computeCycleVolumeByMuscle(
      [makeFb('2026-01-05', [{ exercise_id: 'bp', n: 4 }, { exercise_id: 'curl', n: 4 }])],
      1,
      makeState(),
      buildMusclesOf(makeCatalog()),
    );
    expect(rows[0]!.muscle).toBe('pectoraux');
    expect(rows[1]!.muscle).toBe('biceps');
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
