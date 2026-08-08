/**
 * Chantier B (plan 11) — déload opt-in : semaine 5 acceptée vs refusée.
 * cf. recherche/09c_deload_optin.md
 *
 * - `isDeloadActive` : vrai seulement en semaine 5 ET décision acceptée.
 * - Séance semaine 5 ACCEPTÉE  → RPE 6, charge plancher ×0,9, moins de séries.
 * - Séance semaine 5 REFUSÉE   → semaine normale (charge plancher, RPE normal,
 *   séries de semaine 4) ET les mesures (e1RM) tournent.
 */
import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  bootstrapMuscleGoalsFromProfile,
  generateSession,
  recordFeedback,
  startUser,
} from '@/engine/engine';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
import { isDeloadActive } from '@/engine/volume';
import type {
  SessionFeedback,
  SessionPlan,
  SetFeedback,
  UserState,
} from '@/engine/models';
import { profile } from './_helpers';

const catalog = new Catalog();

function setup(): UserState {
  const p = profile();
  const goals = bootstrapMuscleGoalsFromProfile(p, [
    'pectoraux', 'dos_largeur', 'quadriceps', 'ischios',
  ]);
  const state = startUser(p, catalog, { muscleGoals: goals });
  state.current_cycle_plan = autoGenerateCyclePlanV3(state, catalog);
  return state;
}

function faithful(plan: SessionPlan): SessionFeedback {
  const sets: SetFeedback[] = [];
  for (const item of plan.items) {
    for (const sp of item.sets) {
      sets.push({
        exercise_id: sp.exercise_id,
        reps_done: sp.reps,
        load_kg: sp.load_kg,
        rpe_perceived: sp.rpe_target,
      });
    }
  }
  return {
    seance_date: plan.seance_date,
    week_in_cycle: plan.week_in_cycle,
    cycle_index: plan.cycle_index,
    rpe_target: plan.rpe_target,
    sets,
    label: plan.label,
  };
}

/** Premier exo de la séance piloté par le cliquet de charge (plancher posé). */
function pickFloorExo(state: UserState, plan: SessionPlan): string {
  for (const item of plan.items) {
    if (state.prescribed_load_floor[item.exercise_id] !== undefined) {
      return item.exercise_id;
    }
  }
  throw new Error('aucun exo à cliquet de charge dans la séance');
}

describe('isDeloadActive', () => {
  it('vrai seulement en semaine 5 + décision acceptée', () => {
    const state = setup();
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    expect(isDeloadActive(state)).toBe(true);
  });

  it('faux si semaine 5 mais décision refusée ou nulle', () => {
    const state = setup();
    state.current_week_in_cycle = 5;
    state.deload_decision = 'declined';
    expect(isDeloadActive(state)).toBe(false);
    state.deload_decision = null;
    expect(isDeloadActive(state)).toBe(false);
  });

  it('faux hors semaine 5 même si accepté', () => {
    const state = setup();
    state.current_week_in_cycle = 4;
    state.deload_decision = 'accepted';
    expect(isDeloadActive(state)).toBe(false);
  });
});

describe('génération de séance en semaine 5 selon la décision', () => {
  it('refusée = semaine normale ; acceptée = récupération (charge, RPE, séries)', () => {
    const state = setup();
    // Semaine 1 : pose les planchers de charge + un RPE de référence par exo.
    state.current_week_in_cycle = 1;
    const w1 = generateSession(state, catalog, 0, '2026-01-05');
    const exId = pickFloorExo(state, w1);
    const floor = state.prescribed_load_floor[exId]!;
    const w1Item = w1.items.find((it) => it.exercise_id === exId)!;

    // Semaine 5 REFUSÉE → identique à une semaine normale.
    state.current_week_in_cycle = 5;
    state.deload_decision = 'declined';
    const declined = generateSession(state, catalog, 0, '2026-02-02');
    const dItem = declined.items.find((it) => it.exercise_id === exId)!;
    expect(dItem.sets[0]!.load_kg).toBe(floor); // pas de ×0,9
    expect(dItem.sets[0]!.rpe_target).toBe(w1Item.sets[0]!.rpe_target); // RPE normal
    expect(dItem.sets.length).toBe(w1Item.sets.length); // séries de semaine de travail

    // Semaine 5 ACCEPTÉE → récupération.
    state.deload_decision = 'accepted';
    const accepted = generateSession(state, catalog, 0, '2026-02-02');
    const aItem = accepted.items.find((it) => it.exercise_id === exId)!;
    expect(aItem.sets[0]!.load_kg).toBeLessThan(floor); // charge allégée (×0,9)
    expect(aItem.sets[0]!.rpe_target).toBe(6); // RPE déload
    expect(aItem.sets.length).toBeLessThan(dItem.sets.length); // moitié moins de séries
  });

  it('#73 A-2 — un plan déjà persisté à 1 série en récup est relevé à 2 à la lecture', () => {
    const state = setup();
    const day = state.current_cycle_plan!.days[0]!;
    // Simule un cycle généré avant le correctif : progression[4] = 1 série.
    for (const ex of day.exercises) {
      ex.progression = [3, 3, 3, 3, 1];
    }
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    const plan = generateSession(state, catalog, 0, '2026-02-02');
    for (const item of plan.items) {
      expect(item.sets.length).toBe(2);
    }
  });

  it('#73 A-2 — un exo volontairement à 1 série reste à 1 en récup', () => {
    const state = setup();
    const day = state.current_cycle_plan!.days[0]!;
    for (const ex of day.exercises) {
      ex.progression = [1, 1, 1, 1, 1];
    }
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    const plan = generateSession(state, catalog, 0, '2026-02-02');
    for (const item of plan.items) {
      expect(item.sets.length).toBe(1);
    }
  });
});

describe('mesures (e1RM) en semaine 5 selon la décision', () => {
  function seeded(): { state: UserState; exId: string; baseline: number } {
    const state = setup();
    state.current_week_in_cycle = 1;
    const w1 = generateSession(state, catalog, 0, '2026-01-05');
    recordFeedback(state, catalog, faithful(w1));
    const exId = pickFloorExo(state, w1);
    return { state, exId, baseline: state.e1rm[exId] ?? 0 };
  }

  function heavyWeek5(state: UserState, exId: string): SessionFeedback {
    const load = (state.e1rm[exId] ?? 100) * 1.5; // clairement plus lourd
    return {
      seance_date: '2026-02-02',
      week_in_cycle: 5,
      cycle_index: state.cycle_index,
      rpe_target: 8,
      label: 'récup',
      sets: [
        { exercise_id: exId, reps_done: 5, load_kg: load, rpe_perceived: 8 },
        { exercise_id: exId, reps_done: 5, load_kg: load, rpe_perceived: 8 },
      ],
    };
  }

  /** Séance de récup jouée telle que prescrite : léger, effort 6. */
  function lightWeek5(state: UserState, exId: string): SessionFeedback {
    const load = (state.e1rm[exId] ?? 100) * 0.4;
    return {
      seance_date: '2026-02-02',
      week_in_cycle: 5,
      cycle_index: state.cycle_index,
      rpe_target: 6,
      label: 'récup',
      sets: [
        { exercise_id: exId, reps_done: 8, load_kg: load, rpe_perceived: 6 },
        { exercise_id: exId, reps_done: 8, load_kg: load, rpe_perceived: 6 },
      ],
    };
  }

  it('acceptée + séance allégée → Plafond inchangé (jamais de recul)', () => {
    const { state, exId, baseline } = seeded();
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    const summary = recordFeedback(state, catalog, lightWeek5(state, exId));
    expect(state.e1rm[exId]).toBe(baseline);
    // #73 A-3 — l'entrée existe (le bilan affiche le Plafond à Δ 0) mais elle
    // n'est pas définitive → aucun snapshot, aucun point sur la courbe Force.
    expect(summary[exId]).not.toBeNull();
    expect(summary[exId]!.definitive).toBe(false);
  });

  it('#73 A-3 — acceptée + charge volontairement lourde → le Plafond monte et compte', () => {
    const { state, exId, baseline } = seeded();
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    const summary = recordFeedback(state, catalog, heavyWeek5(state, exId));
    expect(state.e1rm[exId]).toBeGreaterThan(baseline);
    expect(summary[exId]!.definitive).toBe(true);
  });

  it('#73 A-3 — acceptée : un exo jamais mesuré n’est pas calibré par une récup', () => {
    const { state, exId } = seeded();
    delete state.e1rm[exId];
    state.current_week_in_cycle = 5;
    state.deload_decision = 'accepted';
    const summary = recordFeedback(state, catalog, heavyWeek5(state, exId));
    expect(state.e1rm[exId]).toBeUndefined();
    expect(summary[exId]).toBeNull();
  });

  it('refusée → e1RM mis à jour (semaine normale)', () => {
    const { state, exId, baseline } = seeded();
    state.current_week_in_cycle = 5;
    state.deload_decision = 'declined';
    recordFeedback(state, catalog, heavyWeek5(state, exId));
    expect(state.e1rm[exId]).toBeGreaterThan(baseline);
  });
});
