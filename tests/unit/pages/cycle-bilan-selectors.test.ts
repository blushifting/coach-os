/**
 * Conv #76 — sélecteurs de la page Bilan de cycle.
 *
 * Régression couverte : le premier cycle terminé menait à « Aucun bilan
 * disponible ». Le `CycleReview` n'était produit que par `endOfCycle()`, donc
 * APRÈS la décision de l'utilisateur — alors que c'est le bilan qui porte
 * cette décision.
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
import { bootstrapMuscleGoalsFromProfile, startUser } from '@/engine/engine';
import { SuggestedAction, makeCycleReview } from '@/engine/models';
import type { CycleReview, SessionFeedback, UserState } from '@/engine/models';
import type { CycleRow, FeedbackRow } from '@/db/schema';
import { addDays, dateKey, parseDateKey } from '@/lib/dashboard';
import {
  overloadedMuscles,
  pickPendingCycleReview,
  pickReviewToDisplay,
} from '@/pages/cycle-bilan/selectors';
import { profile } from '../engine/_helpers';

const catalog = new Catalog();
const START = '2026-06-01';

function stateWithPlan(): UserState {
  const p = profile();
  const goals = bootstrapMuscleGoalsFromProfile(p, [
    'pectoraux',
    'dos_largeur',
    'quadriceps',
    'ischios',
  ]);
  const state = startUser(p, catalog, { muscleGoals: goals });
  state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);
  return state;
}

/** Bilan archivé minimal — seul `cycle_index` compte pour ces sélecteurs. */
function makeReview(cycleIndex: number): CycleReview {
  return makeCycleReview({
    cycle_index: cycleIndex,
    plafonds_progression: {},
    muscles_progresses: [],
    muscles_plateau: [],
    muscles_undertrained: [],
    muscles_overshoot: [],
    adherence_pct: 0.8,
    volume_total_kg: 0,
    PRs: [],
    suggested_action: SuggestedAction.CONTINUER_PAREIL,
  });
}

function makeCycle(overrides: Partial<CycleRow> = {}): CycleRow {
  return {
    cycle_index: 1,
    start_date: START,
    end_date: null,
    review: null,
    ...overrides,
  };
}

/** Ajoute `n` séances faites au cycle courant (state + lignes DB). */
function withSessions(state: UserState, n: number): FeedbackRow[] {
  const rows: FeedbackRow[] = [];
  for (let i = 0; i < n; i++) {
    const date = dateKey(addDays(parseDateKey(START), i));
    const feedback: SessionFeedback = {
      seance_date: date,
      week_in_cycle: 1,
      cycle_index: state.cycle_index,
      rpe_target: 8,
      sets: [{ exercise_id: 'bench_bb', reps_done: 5, load_kg: 80, rpe_perceived: 8 }],
      label: 'Test',
    };
    state.history.push(feedback);
    state.e1rm['bench_bb'] = 100;
    rows.push({
      seance_date: date,
      cycle_index: state.cycle_index,
      week_in_cycle: 1,
      session_id: null,
      feedback,
      created_at: date,
    });
  }
  return rows;
}

describe('pickPendingCycleReview', () => {
  it('cycle en cours (fin non atteinte) → aucun bilan anticipé', () => {
    const state = stateWithPlan();
    const feedbacks = withSessions(state, 2);
    expect(
      pickPendingCycleReview({
        userState: state,
        catalog,
        cycles: [makeCycle()],
        feedbacks,
        // J+7 : on est en semaine 2, le cycle court sur 5 semaines.
        today: addDays(parseDateKey(START), 7),
      }),
    ).toBeNull();
  });

  it('fin de cycle dépassée → bilan du cycle EN COURS calculé à la volée', () => {
    const state = stateWithPlan();
    const feedbacks = withSessions(state, 6);
    const review = pickPendingCycleReview({
      userState: state,
      catalog,
      cycles: [makeCycle()],
      feedbacks,
      // J+35 : premier jour après les 5 semaines (le cas d'Azur, conv #76).
      today: addDays(parseDateKey(START), 35),
    });
    expect(review).not.toBeNull();
    expect(review!.cycle_index).toBe(state.cycle_index);
    expect(review!.adherence_pct).toBeGreaterThan(0);
  });

  it('ne mute pas le state (contrairement à endOfCycle)', () => {
    const state = stateWithPlan();
    const feedbacks = withSessions(state, 6);
    const before = JSON.stringify(state);
    pickPendingCycleReview({
      userState: state,
      catalog,
      cycles: [makeCycle()],
      feedbacks,
      today: addDays(parseDateKey(START), 35),
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('cycle déjà clos (review archivée) → null, la version persistée fait foi', () => {
    const state = stateWithPlan();
    const feedbacks = withSessions(state, 6);
    const archived = makeReview(state.cycle_index);
    expect(
      pickPendingCycleReview({
        userState: state,
        catalog,
        cycles: [makeCycle({ review: archived })],
        feedbacks,
        today: addDays(parseDateKey(START), 35),
      }),
    ).toBeNull();
  });

  it('aucune séance faite → pas de bilan vide, même hors délai', () => {
    const state = stateWithPlan();
    expect(
      pickPendingCycleReview({
        userState: state,
        catalog,
        cycles: [makeCycle()],
        feedbacks: [],
        today: addDays(parseDateKey(START), 60),
      }),
    ).toBeNull();
  });

  it('catalog non chargé → null (pas de crash au premier render)', () => {
    const state = stateWithPlan();
    const feedbacks = withSessions(state, 6);
    expect(
      pickPendingCycleReview({
        userState: state,
        catalog: null,
        cycles: [makeCycle()],
        feedbacks,
        today: addDays(parseDateKey(START), 35),
      }),
    ).toBeNull();
  });
});

describe('overloadedMuscles', () => {
  function reviewWith(overshoot: string[], plateau: string[]): CycleReview {
    const r = makeReview(1);
    r.muscles_overshoot = overshoot;
    r.muscles_plateau = plateau;
    return r;
  }

  it('alerte seulement sur les muscles à la fois surchargés ET en recul', () => {
    expect(
      overloadedMuscles(reviewWith(['pectoraux', 'dos_largeur'], ['pectoraux', 'biceps'])),
    ).toEqual(['pectoraux']);
  });

  it('beaucoup de volume sans recul → aucune alerte', () => {
    expect(overloadedMuscles(reviewWith(['pectoraux'], []))).toEqual([]);
  });

  it('recul sans excès de volume → aucune alerte (on n’accuse pas le programme)', () => {
    expect(overloadedMuscles(reviewWith([], ['pectoraux']))).toEqual([]);
  });
});

describe('pickReviewToDisplay', () => {
  it('sans bilan en mémoire → dernier bilan archivé', () => {
    const r1 = makeReview(1);
    const r2 = makeReview(2);
    const cycles = [
      makeCycle({ cycle_index: 1, review: r1 }),
      makeCycle({ cycle_index: 2, review: r2 }),
      makeCycle({ cycle_index: 3, review: null }),
    ];
    expect(pickReviewToDisplay(null, cycles)?.cycle_index).toBe(2);
  });

  it('bilan en mémoire prioritaire', () => {
    const inMemory: CycleReview = makeReview(9);
    expect(pickReviewToDisplay(inMemory, [makeCycle()])?.cycle_index).toBe(9);
  });
});
