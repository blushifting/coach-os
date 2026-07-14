/**
 * Tests purs sur `src/lib/dashboard.ts` — sélecteurs du Dashboard Programme.
 */

import { describe, expect, it } from 'vitest';
import {
  CYCLE_LENGTH_WEEKS,
  addDays,
  buildCalendarMatrix,
  computeCycleProgress,
  computeStreak,
  computeWeekSessions,
  dateKey,
  weekKeyFor,
  weekStartFor,
  isCycleFinished,
  nextCycleReviewDate,
  computeCycleTimeProgress,
  parseDateKey,
  plannedSessionsForCycle,
  startOfWeekMonday,
  weekKey,
} from '@/lib/dashboard';
import type {
  DayTemplate,
  PlannedExercise,
  SessionPlan,
  UserState,
  WeeklyTemplate,
} from '@/engine/models';
import type { CycleRow, FeedbackRow, SessionRow } from '@/db/schema';

// =============================================================================
// Fixtures minimales
// =============================================================================

function makeDay(idx: number): DayTemplate {
  return {
    day_index: idx,
    label: `Jour ${idx + 1}`,
    target_muscles_focus: [],
    exercises: [] as PlannedExercise[],
  };
}

function makeWeekly(numDays: number, cycleIndex = 1): WeeklyTemplate {
  return {
    cycle_index: cycleIndex,
    rationale: '',
    days: Array.from({ length: numDays }, (_, i) => makeDay(i)),
    warnings: [],
  };
}

function makeState(overrides: Partial<UserState> = {}): UserState {
  return {
    profile: {} as UserState['profile'],
    e1rm: {},
    k_user: {},
    volume_min: {},
    volume_max: {},
    current_week_in_cycle: 1,
    cycle_index: 1,
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {},
    current_cycle_plan: null,
    equipment_overrides: {},
    prescribed_load_floor: {},
    prescribed_reps_floor: {},
    ...overrides,
  };
}

function makeFeedback(
  seanceDate: string,
  cycleIndex: number,
  weekInCycle: number,
  label = 'Test',
): FeedbackRow {
  return {
    seance_date: seanceDate,
    cycle_index: cycleIndex,
    week_in_cycle: weekInCycle,
    session_id: null,
    feedback: {
      seance_date: seanceDate,
      week_in_cycle: weekInCycle,
      cycle_index: cycleIndex,
      rpe_target: 8,
      sets: [],
      label,
    },
    created_at: seanceDate,
  };
}

function makeSession(
  seanceDate: string,
  status: 'planned' | 'completed' | 'skipped' = 'planned',
  label = 'Push',
  id: number | null = 1,
): SessionRow {
  const plan: SessionPlan = {
    seance_date: seanceDate,
    week_in_cycle: 1,
    cycle_index: 1,
    rpe_target: 8,
    items: [],
    label,
  };
  return {
    id: id ?? undefined,
    seance_date: seanceDate,
    week_in_cycle: 1,
    cycle_index: 1,
    plan,
    status,
    created_at: seanceDate,
  };
}

// =============================================================================
// Helpers date
// =============================================================================

describe('helpers date', () => {
  it('dateKey / parseDateKey roundtrip', () => {
    const d = new Date(2026, 4, 13);
    expect(dateKey(d)).toBe('2026-05-13');
    expect(dateKey(parseDateKey('2026-05-13'))).toBe('2026-05-13');
  });

  it('startOfWeekMonday : un mercredi renvoie le lundi précédent', () => {
    // 2026-05-13 est un mercredi
    const wed = parseDateKey('2026-05-13');
    expect(dateKey(startOfWeekMonday(wed))).toBe('2026-05-11');
  });

  it('startOfWeekMonday : un dimanche renvoie le lundi 6 jours avant', () => {
    // 2026-05-17 dimanche
    const sun = parseDateKey('2026-05-17');
    expect(dateKey(startOfWeekMonday(sun))).toBe('2026-05-11');
  });

  it('weekKey : tous les jours d\'une même semaine ISO ont la même clé', () => {
    const k = weekKey(parseDateKey('2026-05-13'));
    expect(weekKey(parseDateKey('2026-05-11'))).toBe(k);
    expect(weekKey(parseDateKey('2026-05-17'))).toBe(k);
    expect(weekKey(parseDateKey('2026-05-18'))).not.toBe(k);
  });

  it('addDays : addition/soustraction de jours', () => {
    expect(dateKey(addDays(parseDateKey('2026-05-13'), 7))).toBe('2026-05-20');
    expect(dateKey(addDays(parseDateKey('2026-05-13'), -1))).toBe('2026-05-12');
  });
});

// =============================================================================
// Streak
// =============================================================================

describe('computeStreak', () => {
  it('zéro feedback → 0', () => {
    expect(computeStreak([])).toBe(0);
  });

  // Conv #18 — la semaine en cours ne compte pas dans le streak (elle n'est
  // pas encore terminée). Le compteur démarre quand la 1re semaine pleine
  // est passée avec au moins une séance dedans.
  it('un feedback cette semaine seulement → 0 (semaine pas terminée)', () => {
    const now = parseDateKey('2026-05-13'); // mer
    const fbs = [{ seance_date: '2026-05-12' }]; // mar, même sem
    expect(computeStreak(fbs, now)).toBe(0);
  });

  it('feedback semaine dernière mais pas cette sem → 1 (pas punitif)', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [{ seance_date: '2026-05-06' }]; // sem -1
    expect(computeStreak(fbs, now)).toBe(1);
  });

  it('feedback il y a 2 sem mais rien cette sem ni la précédente → 0', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [{ seance_date: '2026-04-30' }];
    expect(computeStreak(fbs, now)).toBe(0);
  });

  it('3 semaines consécutives avec ≥1 feedback → 2 (sem en cours exclue)', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-12' }, // sem 0 (en cours, exclue)
      { seance_date: '2026-05-05' }, // sem -1
      { seance_date: '2026-04-29' }, // sem -2
    ];
    expect(computeStreak(fbs, now)).toBe(2);
  });

  it('trou en sem -1 casse le streak immédiatement → 0', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-12' }, // sem 0 (exclue)
      // pas de sem -1
      { seance_date: '2026-04-28' }, // sem -2
    ];
    expect(computeStreak(fbs, now)).toBe(0);
  });

  it('plusieurs feedbacks même semaine + sem -1 → 1 (sem -1 seule comptée)', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-11' }, // sem 0
      { seance_date: '2026-05-13' }, // sem 0
      { seance_date: '2026-05-05' }, // sem -1
    ];
    expect(computeStreak(fbs, now)).toBe(1);
  });
});

// =============================================================================
// computeCycleProgress / computeWeekSessions / plannedSessionsForCycle
// =============================================================================

// Conv #11h — semaines de programme alignées sur cycleStart.
describe('weekStartFor / weekKeyFor', () => {
  it("sans cycleStart : fallback semaine ISO lundi-dim", () => {
    // 2026-05-13 = mercredi → lundi ISO = 2026-05-11
    expect(weekKeyFor(parseDateKey('2026-05-13'), null)).toBe('2026-05-11');
    expect(weekKeyFor(parseDateKey('2026-05-17'), null)).toBe('2026-05-11');
    expect(weekKeyFor(parseDateKey('2026-05-18'), null)).toBe('2026-05-18');
  });

  it("avec cycleStart = mercredi : semaines mer→mar", () => {
    const cs = '2026-05-13'; // mercredi
    expect(weekKeyFor(parseDateKey('2026-05-13'), cs)).toBe('2026-05-13');
    expect(weekKeyFor(parseDateKey('2026-05-19'), cs)).toBe('2026-05-13'); // mardi suivant
    expect(weekKeyFor(parseDateKey('2026-05-20'), cs)).toBe('2026-05-20'); // mer suivant = S2J1
    expect(weekKeyFor(parseDateKey('2026-06-10'), cs)).toBe('2026-06-10'); // S5J1
  });

  it("date avant cycleStart : weekIndex négatif possible mais pas crash", () => {
    const cs = '2026-05-13';
    expect(() => weekStartFor(parseDateKey('2026-05-01'), cs)).not.toThrow();
  });
});

describe('plannedSessionsForCycle', () => {
  it('null → 0', () => {
    expect(plannedSessionsForCycle(null)).toBe(0);
  });

  it('3 jours × 5 sem = 15 séances', () => {
    expect(plannedSessionsForCycle(makeWeekly(3))).toBe(15);
  });
});

describe('computeCycleProgress', () => {
  it('cycle non posé → 0/0/0', () => {
    const state = makeState();
    expect(computeCycleProgress(state, [])).toEqual({ done: 0, planned: 0, pct: 0 });
  });

  it('4 feedbacks sur 15 planifiés → 27 %', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = [
      makeFeedback('2026-05-01', 1, 1),
      makeFeedback('2026-05-03', 1, 1),
      makeFeedback('2026-05-05', 1, 2),
      makeFeedback('2026-05-08', 1, 2),
    ];
    expect(computeCycleProgress(state, fbs)).toEqual({ done: 4, planned: 15, pct: 27 });
  });

  it('feedbacks d\'un autre cycle ne sont pas comptés', () => {
    const state = makeState({ cycle_index: 2, current_cycle_plan: makeWeekly(3, 2) });
    const fbs = [
      makeFeedback('2026-04-01', 1, 1), // ancien cycle
      makeFeedback('2026-05-01', 2, 1),
    ];
    expect(computeCycleProgress(state, fbs).done).toBe(1);
  });

});

describe('computeWeekSessions', () => {
  it('compte uniquement les feedbacks de la semaine en cours', () => {
    const state = makeState({
      current_week_in_cycle: 2,
      current_cycle_plan: makeWeekly(4),
    });
    const fbs = [
      makeFeedback('2026-05-01', 1, 1), // sem 1
      makeFeedback('2026-05-08', 1, 2), // sem 2
      makeFeedback('2026-05-10', 1, 2), // sem 2
    ];
    expect(computeWeekSessions(state, fbs)).toEqual({ done: 2, planned: 4 });
  });

});

// =============================================================================
// nextCycleReviewDate / isCycleFinished
// =============================================================================

describe('nextCycleReviewDate', () => {
  it('null si pas de cycle correspondant', () => {
    const state = makeState({ cycle_index: 1 });
    expect(nextCycleReviewDate(state, [])).toBeNull();
  });

  it('start_date + 5 sem - 1j', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-04', end_date: null, review: null },
    ];
    // 2026-05-04 lundi + 35j - 1 = 2026-06-07 (dim)
    expect(nextCycleReviewDate(state, cycles)).toBe('2026-06-07');
  });
});

describe('computeCycleTimeProgress', () => {
  const cycles: CycleRow[] = [
    { cycle_index: 1, start_date: '2026-05-04', end_date: null, review: null },
  ];

  it('null si pas de cycle correspondant', () => {
    const state = makeState({ cycle_index: 1 });
    expect(computeCycleTimeProgress(state, [])).toBeNull();
  });

  it('jour 0 = 0 % et 35 jours restants', () => {
    const state = makeState({ cycle_index: 1 });
    const out = computeCycleTimeProgress(state, cycles, new Date(2026, 4, 4));
    expect(out).toEqual({ daysTotal: 35, daysElapsed: 0, daysLeft: 35, pct: 0 });
  });

  it('mi-cycle ≈ 50 %', () => {
    const state = makeState({ cycle_index: 1 });
    // +17 jours = 17/35 ≈ 49 %
    const out = computeCycleTimeProgress(state, cycles, new Date(2026, 4, 21));
    expect(out?.daysElapsed).toBe(17);
    expect(out?.daysLeft).toBe(18);
    expect(out?.pct).toBe(49);
  });

  it('fin de cycle = 100 % saturé', () => {
    const state = makeState({ cycle_index: 1 });
    // +35 jours, on dépasse → saturé à daysTotal
    const out = computeCycleTimeProgress(state, cycles, new Date(2026, 5, 8));
    expect(out).toEqual({ daysTotal: 35, daysElapsed: 35, daysLeft: 0, pct: 100 });
  });

  it('avant le début du cycle = 0 % saturé', () => {
    const state = makeState({ cycle_index: 1 });
    const out = computeCycleTimeProgress(state, cycles, new Date(2026, 4, 1));
    expect(out?.daysElapsed).toBe(0);
    expect(out?.pct).toBe(0);
  });
});

describe('isCycleFinished', () => {
  // start 2026-05-04 → fin de cycle = start + 34 j = 2026-06-07.
  const cycles: CycleRow[] = [
    { cycle_index: 1, start_date: '2026-05-04', end_date: null, review: null },
  ];
  const dansLeCycle = new Date(2026, 4, 10); // 2026-05-10
  const apresLaFin = new Date(2026, 5, 8); // 2026-06-08 > 2026-06-07

  it('faux si plan null', () => {
    const state = makeState();
    expect(isCycleFinished(state, [], cycles, apresLaFin)).toBe(false);
  });

  // Porte 1 — travail : toutes les séances faites, même avant la fin de date.
  it('vrai si toutes les séances ont un feedback (avant la date de fin)', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = Array.from({ length: 15 }, (_, i) =>
      makeFeedback(`2026-05-${String(i + 1).padStart(2, '0')}`, 1, 1),
    );
    expect(isCycleFinished(state, fbs, cycles, dansLeCycle)).toBe(true);
  });

  // Porte 2 — date : fin dépassée + cycle démarré (séances manquantes).
  it('vrai si date dépassée et ≥1 séance faite (séances ratées)', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = Array.from({ length: 14 }, (_, i) =>
      makeFeedback(`2026-05-${String(i + 1).padStart(2, '0')}`, 1, 1),
    );
    expect(isCycleFinished(state, fbs, cycles, apresLaFin)).toBe(true);
  });

  it('faux si date dépassée mais aucune séance faite (cycle pas démarré)', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    expect(isCycleFinished(state, [], cycles, apresLaFin)).toBe(false);
  });

  it('faux si séances manquantes et date non dépassée', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = [makeFeedback('2026-05-05', 1, 1)];
    expect(isCycleFinished(state, fbs, cycles, dansLeCycle)).toBe(false);
  });

  it('faux si date dépassée, démarré, mais aucun CycleRow correspondant', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = [makeFeedback('2026-05-05', 1, 1)];
    expect(isCycleFinished(state, fbs, [], apresLaFin)).toBe(false);
  });
});

// =============================================================================
// buildCalendarMatrix
// =============================================================================

describe('buildCalendarMatrix', () => {
  it('null si aucun CycleRow', () => {
    const state = makeState({ cycle_index: 1 });
    expect(buildCalendarMatrix(state, [], [], [])).toBeNull();
  });

  it('grille 5 × 7 alignée sur cycle.start_date (S1J1 en première case)', () => {
    // Conv #11h — anchor = start_date directement (pas le lundi ISO), pour
    // que la 5e ligne corresponde exactement à la semaine de déload selon
    // l'engine. La 1re colonne porte le jour de démarrage (mer/jeu/...).
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      // 2026-05-13 = mercredi → 1re case = mercredi (anchor)
      { cycle_index: 1, start_date: '2026-05-13', end_date: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m).not.toBeNull();
    expect(m!.weeks).toHaveLength(CYCLE_LENGTH_WEEKS);
    expect(m!.weeks[0]!).toHaveLength(7);
    expect(m!.cycleStart).toBe('2026-05-13');
    expect(m!.weeks[0]![0]!.date).toBe('2026-05-13');
    // S5J7 = J35 depuis start = 5×7 - 1 = 34 jours après start
    expect(m!.weeks[4]![6]!.date).toBe('2026-06-16');
    // dayOfWeek réel : 2026-05-13 = mercredi → 2 (Lun=0)
    expect(m!.weeks[0]![0]!.dayOfWeek).toBe(2);
    expect(m!.weeks[0]![6]!.dayOfWeek).toBe(1); // mardi
  });

  it('statut completed si feedback à la date', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const sessions = [makeSession('2026-05-12', 'completed', 'Pousser')];
    const fbs = [makeFeedback('2026-05-12', 1, 1)];
    const m = buildCalendarMatrix(state, cycles, sessions, fbs, parseDateKey('2026-05-13'));
    const cell = m!.weeks[0]![1]!; // mardi
    expect(cell.date).toBe('2026-05-12');
    expect(cell.status).toBe('completed');
    expect(cell.sessionLabel).toBe('Pousser');
  });

  it('statut planned si session future sans feedback', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const sessions = [makeSession('2026-05-15', 'planned', 'Tirer')];
    const m = buildCalendarMatrix(state, cycles, sessions, [], parseDateKey('2026-05-13'));
    const cell = m!.weeks[0]![4]!; // vendredi
    expect(cell.status).toBe('planned');
    expect(cell.sessionLabel).toBe('Tirer');
  });

  it('statut rest-past pour un jour passé sans séance', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[0]![0]!.status).toBe('rest-past'); // lundi 11, passé
  });

  it('statut free-future pour un jour à venir sans séance', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[0]![4]!.status).toBe('free-future'); // vendredi
  });

  it('les 7 cases de la semaine 5 portent weekInCycle=5', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[4]!.every((c) => c.weekInCycle === 5)).toBe(true);
    expect(m!.weeks[0]!.every((c) => c.weekInCycle === 1)).toBe(true);
  });

  it('marque isToday sur la bonne case', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    const todays = m!.weeks.flat().filter((c) => c.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]!.date).toBe('2026-05-13');
  });

  // Conv #29 — concept de « séance sautée » retiré : une séance planifiée
  // passée sans feedback redevient un simple jour passé (rest-past).
  it('séance planned dans le passé sans feedback → status=rest-past', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, review: null },
    ];
    const sessions = [makeSession('2026-05-12', 'planned', 'Tirer')];
    const m = buildCalendarMatrix(state, cycles, sessions, [], parseDateKey('2026-05-13'));
    // 2026-05-12 = mardi → semaine 1, jour index 1 (lundi=0).
    const cellYesterday = m!.weeks[0]![1]!;
    expect(cellYesterday.date).toBe('2026-05-12');
    expect(cellYesterday.status).toBe('rest-past');
  });
});
