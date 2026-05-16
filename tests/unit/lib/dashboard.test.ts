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
  isCycleFinished,
  isDeloadWeek,
  nextCycleReviewDate,
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
    requires_calibration: false,
    warnings: [],
  };
}

function makeState(overrides: Partial<UserState> = {}): UserState {
  return {
    profile: {} as UserState['profile'],
    e1rm: {},
    k_user: {},
    reps_pr: {},
    volume_min: {},
    volume_max: {},
    current_week_in_cycle: 1,
    cycle_index: 1,
    plateau_counter: {},
    history: [],
    last_used_for_muscle: {},
    muscle_goals: {},
    current_cycle_plan: null,
    active_guided_program_id: null,
    recovery_mode: false,
    recovery_weeks_remaining: 0,
    equipment_overrides: {},
    ...overrides,
  };
}

function makeFeedback(
  seanceDate: string,
  cycleIndex: number,
  weekInCycle: number,
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
      label: 'Test',
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

  it('un feedback cette semaine → 1', () => {
    const now = parseDateKey('2026-05-13'); // mer
    const fbs = [{ seance_date: '2026-05-12' }]; // mar, même sem
    expect(computeStreak(fbs, now)).toBe(1);
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

  it('3 semaines consécutives avec ≥1 feedback → 3', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-12' }, // sem 0
      { seance_date: '2026-05-05' }, // sem -1
      { seance_date: '2026-04-29' }, // sem -2
    ];
    expect(computeStreak(fbs, now)).toBe(3);
  });

  it('trou au milieu casse le streak (revient à la sous-série du présent)', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-12' }, // sem 0
      // pas de sem -1
      { seance_date: '2026-04-28' }, // sem -2
    ];
    expect(computeStreak(fbs, now)).toBe(1);
  });

  it('plusieurs feedbacks dans la même semaine comptent comme 1', () => {
    const now = parseDateKey('2026-05-13');
    const fbs = [
      { seance_date: '2026-05-11' },
      { seance_date: '2026-05-13' },
      { seance_date: '2026-05-05' },
    ];
    expect(computeStreak(fbs, now)).toBe(2);
  });
});

// =============================================================================
// computeCycleProgress / computeWeekSessions / plannedSessionsForCycle
// =============================================================================

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
// isDeloadWeek / nextCycleReviewDate / isCycleFinished
// =============================================================================

describe('isDeloadWeek', () => {
  it('vrai en S5, faux ailleurs', () => {
    expect(isDeloadWeek(1)).toBe(false);
    expect(isDeloadWeek(4)).toBe(false);
    expect(isDeloadWeek(5)).toBe(true);
    expect(isDeloadWeek(6)).toBe(false);
  });
});

describe('nextCycleReviewDate', () => {
  it('null si pas de cycle correspondant', () => {
    const state = makeState({ cycle_index: 1 });
    expect(nextCycleReviewDate(state, [])).toBeNull();
  });

  it('start_date + 5 sem - 1j', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-04', end_date: null, programme_id: null, review: null },
    ];
    // 2026-05-04 lundi + 35j - 1 = 2026-06-07 (dim)
    expect(nextCycleReviewDate(state, cycles)).toBe('2026-06-07');
  });
});

describe('isCycleFinished', () => {
  it('faux si plan null', () => {
    const state = makeState();
    expect(isCycleFinished(state, [])).toBe(false);
  });

  it('vrai si week_in_cycle > 5', () => {
    const state = makeState({
      current_week_in_cycle: 6,
      current_cycle_plan: makeWeekly(3),
    });
    expect(isCycleFinished(state, [])).toBe(true);
  });

  it('vrai si toutes les séances ont un feedback', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = Array.from({ length: 15 }, (_, i) => makeFeedback(`2026-05-${String(i + 1).padStart(2, '0')}`, 1, 1));
    expect(isCycleFinished(state, fbs)).toBe(true);
  });

  it('faux si seulement quelques séances faites', () => {
    const state = makeState({ current_cycle_plan: makeWeekly(3) });
    const fbs = [makeFeedback('2026-05-01', 1, 1)];
    expect(isCycleFinished(state, fbs)).toBe(false);
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

  it('grille 5 × 7 ancrée sur le lundi de la semaine du start_date', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      // 2026-05-13 = mercredi → lundi d'ancrage = 2026-05-11
      { cycle_index: 1, start_date: '2026-05-13', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m).not.toBeNull();
    expect(m!.weeks).toHaveLength(CYCLE_LENGTH_WEEKS);
    expect(m!.weeks[0]!).toHaveLength(7);
    expect(m!.cycleStart).toBe('2026-05-11');
    expect(m!.weeks[0]![0]!.date).toBe('2026-05-11');
    expect(m!.weeks[4]![6]!.date).toBe('2026-06-14');
  });

  it('statut completed si feedback à la date', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
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
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
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
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[0]![0]!.status).toBe('rest-past'); // lundi 11, passé
  });

  it('statut free-future pour un jour à venir sans séance', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[0]![4]!.status).toBe('free-future'); // vendredi
  });

  it('marque isDeload sur les 7 cases de la semaine 5', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    expect(m!.weeks[4]!.every((c) => c.isDeload)).toBe(true);
    expect(m!.weeks[0]!.every((c) => !c.isDeload)).toBe(true);
  });

  it('marque isToday sur la bonne case', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    const todays = m!.weeks.flat().filter((c) => c.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]!.date).toBe('2026-05-13');
  });

  // Conv #10d — restSuggested
  it('restSuggested=true sur un jour libre futur dont la veille est planifiée', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const sessions = [makeSession('2026-05-15', 'planned', 'Tirer')];
    const m = buildCalendarMatrix(state, cycles, sessions, [], parseDateKey('2026-05-13'));
    // 2026-05-16 = samedi (jour suivant le vendredi planifié)
    const cell = m!.weeks[0]![5]!;
    expect(cell.date).toBe('2026-05-16');
    expect(cell.status).toBe('free-future');
    expect(cell.restSuggested).toBe(true);
  });

  it('restSuggested=false si la veille n\'a pas de séance', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const m = buildCalendarMatrix(state, cycles, [], [], parseDateKey('2026-05-13'));
    for (const cell of m!.weeks.flat()) {
      expect(cell.restSuggested).toBe(false);
    }
  });

  it('restSuggested=false si le jour est lui-même planned ou completed', () => {
    const state = makeState({ cycle_index: 1 });
    const cycles: CycleRow[] = [
      { cycle_index: 1, start_date: '2026-05-11', end_date: null, programme_id: null, review: null },
    ];
    const sessions = [
      makeSession('2026-05-15', 'planned', 'Tirer'),
      makeSession('2026-05-16', 'planned', 'Pousser', 2),
    ];
    const m = buildCalendarMatrix(state, cycles, sessions, [], parseDateKey('2026-05-13'));
    const cell = m!.weeks[0]![5]!; // 2026-05-16
    expect(cell.status).toBe('planned');
    expect(cell.restSuggested).toBe(false); // déjà planifié → pas de suggestion
  });
});
