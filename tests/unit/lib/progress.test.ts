/**
 * Tests purs sur `src/lib/progress.ts` — sélecteurs de l'onglet Progrès.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCycleHistory,
  buildMusclesOf,
  classifyVolume,
  computeCoverageThisWeek,
  computeCycleVolume,
  computeE1rmSeriesFromSnapshots,
  computeLastWorkedByMuscle,
  cycleBoundaries,
  displayMark,
  exerciseLabel,
  formatCycleDates,
  formatWeekLabel,
  muscleLabel,
  volumeScale,
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
import { MuscleIntention,
  ChargeType,
  ExType,
  Pattern,
  Sex,
  SuggestedAction,
  exerciseFromDict } from '@/engine/models';

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
      sessions_per_week: 4,
      bodyweight_kg: 75,
      available_equip: new Set(),
    } as UserState['profile'],
    e1rm: {},
    k_user: {},
    volume_min: { pectoraux: 10, biceps: 8, quadriceps: 10 },
    current_week_in_cycle: 2,
    cycle_index: 1,
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {
      pectoraux: {
        muscle: 'pectoraux',
        intention: MuscleIntention.DEVELOPPER,
        priority_rank: 1,
      },
      biceps: {
        muscle: 'biceps',
        intention: MuscleIntention.DEVELOPPER,
        priority_rank: 2,
      },
      quadriceps: {
        muscle: 'quadriceps',
        intention: MuscleIntention.DEVELOPPER,
        priority_rank: 3,
      },
    },
    current_cycle_plan: null,
    equipment_overrides: {},
    rep_ranges: {},
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
  adherence_pct?: number;
  muscle_goals_snapshot?: CycleReview['muscle_goals_snapshot'];
}): CycleReview {
  return {
    cycle_index: input.cycle_index,
    plafonds_progression: input.plafonds,
    muscles_progresses: [],
    muscles_plateau: [],
    muscles_undertrained: [],
    muscles_overshoot: [],
    adherence_pct: input.adherence_pct ?? 1,
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
// computeCoverageThisWeek (dump 2.4, étape 3 : un repère, zone haute à 20)
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

  it('compte la semaine courante uniquement, sous le seuil → sous_repere', () => {
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
    expect(pec?.mark).toBe(10);
    expect(pec?.status).toBe('sous_repere');
  });

  it('passe à ok dès le seuil atteint, et le reste jusqu’à 20', () => {
    const state = makeState();
    const at = (n: number) =>
      computeCoverageThisWeek(
        state,
        [makeFb('2026-05-13', [{ exercise_id: 'bp', n }])],
        musclesOf,
        NOW,
      ).find((c) => c.muscle === 'pectoraux')!.status;
    expect(at(10)).toBe('ok');
    expect(at(20)).toBe('ok');
    expect(at(21)).toBe('eleve');
  });

  it('un muscle à entretenir reste « ok » au-dessus de son seuil de croissance', () => {
    const state = makeState({
      muscle_goals: {
        biceps: { muscle: 'biceps', intention: MuscleIntention.ENTRETENIR, priority_rank: 99 },
      },
    });
    const cov = computeCoverageThisWeek(
      state,
      [makeFb('2026-05-13', [{ exercise_id: 'curl', n: 12 }])],
      musclesOf,
      NOW,
    );
    const bi = cov.find((c) => c.muscle === 'biceps')!;
    expect(bi.mark).toBe(4); // plancher 0,4 × 8 = 3,2, affiché 4
    expect(bi.status).toBe('ok');
  });

  it('un muscle sans objectif : pas de repère, jamais d’alerte sous 20 (D2)', () => {
    const state = makeState({ muscle_goals: {} });
    const cov = computeCoverageThisWeek(
      state,
      [makeFb('2026-05-13', [{ exercise_id: 'bp', n: 6 }])],
      musclesOf,
      NOW,
    );
    const pec = cov.find((c) => c.muscle === 'pectoraux')!;
    expect(pec.mark).toBeNull();
    expect(pec.status).toBe('sans_objectif');
    // Travaillé hors du profil (synergiste) : listé aussi, sans repère.
    expect(cov.find((c) => c.muscle === 'triceps')?.status).toBe('sans_objectif');
  });
});

describe('classifyVolume', () => {
  it('suit l’ordre : zéro, au-delà de 20, sans repère, sous le repère, ok', () => {
    expect(classifyVolume(0, 10)).toBe('non_travaille');
    expect(classifyVolume(25, null)).toBe('eleve');
    expect(classifyVolume(25, 10)).toBe('eleve');
    expect(classifyVolume(7, null)).toBe('sans_objectif');
    expect(classifyVolume(7, 10)).toBe('sous_repere');
    expect(classifyVolume(9.98, 10)).toBe('ok'); // arrondi flottant pile au repère
    expect(classifyVolume(20.02, 10)).toBe('ok');
  });
});

describe('volumeScale', () => {
  it('vaut la zone haute (20), allongée seulement par un muscle au-delà', () => {
    expect(volumeScale([])).toBe(20);
    expect(volumeScale([3, 12, 19.5])).toBe(20);
    expect(volumeScale([3, 23])).toBe(23);
  });
});

describe('displayMark', () => {
  it('arrondit le repère au supérieur, sans epsilon parasite (conv #77)', () => {
    expect(displayMark(2.4)).toBe(3);
    expect(displayMark(4.8)).toBe(5);
    expect(displayMark(10)).toBe(10);
    expect(displayMark(6.0000001)).toBe(6);
    expect(displayMark(null)).toBeNull();
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

  it('calcule delta assiduité et delta top plafond vs cycle précédent', () => {
    const items = buildCycleHistory(
      [
        makeCycleRow(
          1,
          '2026-03-01',
          '2026-04-01',
          makeReview({
            cycle_index: 1,
            plafonds: { bp: 5 },
            volume_total_kg: 8000,
            adherence_pct: 0.6,
          }),
        ),
        makeCycleRow(
          2,
          '2026-04-02',
          '2026-05-01',
          makeReview({
            cycle_index: 2,
            plafonds: { bp: 8 },
            volume_total_kg: 11000,
            adherence_pct: 0.85,
          }),
        ),
      ],
    );
    const latest = items[0]!;
    expect(latest.adherencePct).toBe(0.85);
    expect(latest.deltaAdherencePts).toBeCloseTo(25, 6);
    expect(latest.deltaTopPlafondKg).toBe(3);
    const oldest = items[1]!;
    expect(oldest.deltaAdherencePts).toBeNull();
    expect(oldest.deltaTopPlafondKg).toBeNull();
  });

  it('assiduité > 100 % plafonnée des deux côtés du delta', () => {
    // Les séances libres gonflent le numérateur : deux cycles « pleins » ne
    // doivent pas afficher d'écart artificiel.
    const items = buildCycleHistory([
      makeCycleRow(
        1,
        '2026-03-01',
        '2026-04-01',
        makeReview({
          cycle_index: 1,
          plafonds: { bp: 5 },
          volume_total_kg: 0,
          adherence_pct: 1.2,
        }),
      ),
      makeCycleRow(
        2,
        '2026-04-02',
        '2026-05-01',
        makeReview({
          cycle_index: 2,
          plafonds: { bp: 5 },
          volume_total_kg: 0,
          adherence_pct: 1.4,
        }),
      ),
    ]);
    expect(items[0]!.deltaAdherencePts).toBe(0);
  });

  it('objectivesByMuscle : un muscle à développer (rang 1) précède un muscle à entretenir alphabétiquement antérieur', () => {
    // 'abducteurs' passe avant 'pectoraux' en alphabétique, mais 'pectoraux'
    // est à développer (rang 1) → il doit remonter en tête. Le bilan mélange
    // ici l'ancien format (statut « suggéré », migré en entretien) et le nouveau.
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
              objective: 'maintien',
              status: 'suggere',
              priority_rank: 99,
            },
            {
              muscle: 'pectoraux',
              intention: MuscleIntention.DEVELOPPER,
              priority_rank: 1,
            },
          ],
        }),
      ),
    ]);
    const obj = items[0]!.objectivesByMuscle!;
    expect(obj.map((o) => o.muscle)).toEqual(['pectoraux', 'abducteurs']);
    expect(obj[1]!.intention).toBe(MuscleIntention.ENTRETENIR);
  });

  it('objectivesByMuscle : plusieurs muscles à développer sont triés par rang croissant', () => {
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
              intention: MuscleIntention.DEVELOPPER,
              priority_rank: 2,
            },
            {
              muscle: 'jambes',
              intention: MuscleIntention.DEVELOPPER,
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
    expect(series[0]!.points[0]).toEqual({ date: '2026-05-01', e1rm: 100, cycleIndex: 1 });
    expect(series[0]!.points[1]).toEqual({ date: '2026-05-08', e1rm: 105, cycleIndex: 1 });
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
// computeCycleVolume (dump 2.4, étape 3 : n° 13, n° 19)
// =============================================================================

describe('computeCycleVolume', () => {
  // Cycle commencé le lundi 5 janvier 2026 : semaines du lundi au dimanche.
  const START = '2026-01-05';
  const musclesOf = buildMusclesOf(makeCatalog());
  /** 10 séries de développé par semaine 1 à 4, 5 en semaine 5 (récupération). */
  const fullCycle = [
    makeFb('2026-01-06', [{ exercise_id: 'bp', n: 10 }]),
    makeFb('2026-01-13', [{ exercise_id: 'bp', n: 10 }]),
    makeFb('2026-01-20', [{ exercise_id: 'bp', n: 10 }]),
    makeFb('2026-01-27', [{ exercise_id: 'bp', n: 10 }]),
    makeFb('2026-02-03', [{ exercise_id: 'bp', n: 5 }]),
  ];
  const closed = (recoveryTaken: boolean | null) =>
    computeCycleVolume(
      makeState(),
      fullCycle,
      musclesOf,
      { cycleIndex: 1, startDate: START, endDate: '2026-02-09', recoveryTaken },
      '2026-02-20',
    );
  const pec = (v: ReturnType<typeof closed>) => v.muscles.find((m) => m.muscle === 'pectoraux')!;

  it('toutes les séances faites, récupération prise → pile sur le repère moyen', () => {
    const v = closed(true);
    expect(v.weeks).toHaveLength(5);
    expect(v.weeks[4]!.recovery).toBe(true);
    expect(v.countedWeeks).toEqual([1, 2, 3, 4, 5]);
    expect(pec(v).perWeek).toEqual([10, 10, 10, 10, 5]);
    expect(pec(v).markPerWeek).toEqual([10, 10, 10, 10, 5]);
    expect(pec(v).average).toBe(9);
    expect(pec(v).averageMark).toBe(9); // (4 × 10 + 5) ÷ 5
    expect(pec(v).averageStatus).toBe('ok');
  });

  it('récupération refusée → la semaine 5 compte comme une semaine normale', () => {
    const v = closed(false);
    expect(pec(v).averageMark).toBe(10);
    expect(pec(v).averageStatus).toBe('sous_repere'); // 45 ÷ 5 = 9 < 10
  });

  it('récupération inconnue (cycle ancien) → la semaine 5 reste hors moyenne', () => {
    const v = closed(null);
    expect(v.countedWeeks).toEqual([1, 2, 3, 4]);
    expect(pec(v).average).toBe(10);
    expect(pec(v).averageMark).toBe(10);
    expect(pec(v).averageStatus).toBe('ok');
  });

  it('cycle clos plus tôt → seules les semaines écoulées comptent', () => {
    const v = computeCycleVolume(
      makeState(),
      fullCycle.slice(0, 2),
      musclesOf,
      { cycleIndex: 1, startDate: START, endDate: '2026-01-15', recoveryTaken: false },
      '2026-02-20',
    );
    expect(v.weeks).toHaveLength(2);
    expect(pec(v).average).toBe(10);
  });

  it('cycle en cours : cinq colonnes, la moyenne sur les semaines terminées', () => {
    const v = computeCycleVolume(
      makeState(),
      fullCycle.slice(0, 3),
      musclesOf,
      { cycleIndex: 1, startDate: START, endDate: null, recoveryTaken: false },
      '2026-01-21', // semaine 3
    );
    expect(v.weeks).toHaveLength(5);
    expect(v.weeks.map((w) => w.started)).toEqual([true, true, true, false, false]);
    expect(v.countedWeeks).toEqual([1, 2]);
    expect(pec(v).perWeek).toEqual([10, 10, 10, 0, 0]);
  });

  it('une séance faite après la fin prévue tombe en semaine 6 et compte', () => {
    const v = computeCycleVolume(
      makeState(),
      [...fullCycle, makeFb('2026-02-10', [{ exercise_id: 'bp', n: 10 }])],
      musclesOf,
      { cycleIndex: 1, startDate: START, endDate: null, recoveryTaken: true },
      '2026-02-11',
    );
    expect(v.weeks).toHaveLength(6);
    expect(pec(v).perWeek[5]).toBe(10);
    expect(v.countedWeeks).toEqual([1, 2, 3, 4, 5]); // semaine 6 en cours
  });

  it('un muscle sans objectif est compté, sans repère', () => {
    const v = closed(true);
    const tri = v.muscles.find((m) => m.muscle === 'triceps')!; // synergiste du bp
    expect(tri.intention).toBeNull();
    expect(tri.averageMark).toBeNull();
    expect(tri.average).toBe(4.5);
    expect(tri.averageStatus).toBe('sans_objectif');
  });

  it('ignore les séances d’un autre cycle', () => {
    const other = { ...makeFb('2026-01-06', [{ exercise_id: 'bp', n: 30 }]), cycle_index: 2 };
    const v = computeCycleVolume(
      makeState(),
      [...fullCycle, other],
      musclesOf,
      { cycleIndex: 1, startDate: START, endDate: '2026-02-09', recoveryTaken: true },
      '2026-02-20',
    );
    expect(pec(v).perWeek[0]).toBe(10);
  });
});

describe('repère affiché et statut ne se contredisent pas (bug lombaires #77)', () => {
  // Lombaires en entretien, seuil 6 → plancher 2,4, affiché 3. Avant le fix,
  // 2 séries pile sortaient en rouge sous un repère qui annonçait 2.
  const catalog = new Catalog([makeExercise('hyperext', { lombaires: 1.0 })]);
  const state = makeState({
    volume_min: { lombaires: 6 },
    muscle_goals: {
      lombaires: {
        muscle: 'lombaires',
        intention: MuscleIntention.ENTRETENIR,
        priority_rank: 99,
      },
    },
  });
  const statusAt = (n: number) =>
    computeCoverageThisWeek(
      state,
      [makeFb('2026-05-04', [{ exercise_id: 'hyperext', n }])],
      buildMusclesOf(catalog),
      new Date('2026-05-06T12:00:00'),
      '2026-05-04',
    ).find((r) => r.muscle === 'lombaires')!;

  it('le repère annoncé est celui qui fait basculer la couleur', () => {
    expect(statusAt(2).mark).toBe(3);
    expect(statusAt(2).status).toBe('sous_repere');
    expect(statusAt(3).status).toBe('ok');
  });
});

describe('cycleBoundaries', () => {
  it('repère chaque changement de cycle, jamais sur le premier point', () => {
    expect(
      cycleBoundaries([
        { cycleIndex: 1 },
        { cycleIndex: 1 },
        { cycleIndex: 2 },
        { cycleIndex: 2 },
        { cycleIndex: 3 },
      ]),
    ).toEqual([
      { index: 2, cycleIndex: 2 },
      { index: 4, cycleIndex: 3 },
    ]);
  });

  it('série d’un seul cycle → aucun repère', () => {
    expect(cycleBoundaries([{ cycleIndex: 1 }, { cycleIndex: 1 }])).toEqual([]);
  });

  it('cycle inconnu (null) → n’ouvre pas de repère', () => {
    expect(cycleBoundaries([{ cycleIndex: null }, { cycleIndex: null }])).toEqual([]);
  });
});
