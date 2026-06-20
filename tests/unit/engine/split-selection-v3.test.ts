/**
 * Conv #39 — Garanties de la refonte de sélection/génération de split (V3).
 *
 * Vérifie les invariants que la refonte devait apporter :
 *  - aucune séance vide, même pour des distributions musculaires atypiques
 *    (ex. « haut du corps seul » → Push/Pull au lieu d'un U/L aux jambes vides) ;
 *  - alternance préservée (pas deux jours non-FULL de même type consécutifs —
 *    c'était le bug U/U/L/L) ;
 *  - priorités couvertes ;
 *  - déterminisme : la régénération en fin de cycle produit la même structure
 *    que l'onboarding (preuve du merge des deux voies).
 */

import { describe, expect, it } from 'vitest';

import { applyBalanceRules } from '@/engine/balance';
import { Catalog } from '@/engine/catalog';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
import { splitAlternationOk } from '@/engine/skeleton_builder';
import { ALL_SPLITS } from '@/engine/split';
import {
  MuscleObjective,
  MuscleStatus,
  type MuscleGoal,
  type UserState,
  exercisePrimaires,
} from '@/engine/models';

import { profile, startUserStub } from './_helpers';

const catalog = new Catalog();

function prio(muscle: string, rank: number): MuscleGoal {
  return {
    muscle,
    objective: MuscleObjective.HYPERTROPHIE,
    status: MuscleStatus.PRIORITAIRE,
    priority_rank: rank,
  };
}

/** État avec N séances et une liste de muscles prioritaires (sans balance). */
function rawState(sessions: number, priorities: string[]): UserState {
  const state = startUserStub(profile({ sessions_per_week: sessions }));
  const goals: Record<string, MuscleGoal> = {};
  priorities.forEach((m, i) => (goals[m] = prio(m, i + 1)));
  state.muscle_goals = goals;
  return state;
}

/** Idem mais avec les règles d'équilibre R1-R4 appliquées (= flux réel). */
function balancedState(sessions: number, priorities: string[]): UserState {
  const state = startUserStub(profile({ sessions_per_week: sessions }));
  const goals: Record<string, MuscleGoal> = {};
  priorities.forEach((m, i) => (goals[m] = prio(m, i + 1)));
  for (const sg of applyBalanceRules(goals)) goals[sg.muscle] = sg;
  state.muscle_goals = goals;
  return state;
}

function kindOf(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('full') || l.includes('focus')) return 'full';
  if (l.includes('upper')) return 'upper';
  if (l.includes('lower')) return 'lower';
  if (l.includes('push')) return 'push';
  if (l.includes('pull')) return 'pull';
  if (l.includes('legs')) return 'legs';
  return 'other';
}

/** Aucun jour non-FULL de même type que le précédent (le bug U/U/L/L). */
function assertAlternation(labels: string[]): void {
  const kinds = labels.map(kindOf);
  for (let i = 1; i < kinds.length; i += 1) {
    if (kinds[i] !== 'full' && kinds[i - 1] !== 'full') {
      expect(kinds[i]).not.toBe(kinds[i - 1]);
    }
  }
}

const PRESET = [
  'pectoraux',
  'dos_largeur',
  'quadriceps',
  'ischios',
  'deltos_lateraux',
];

// =============================================================================
// 1. Préset full-body : aucune séance vide + alternance, à 3/4/5/6 séances
// =============================================================================

describe('autoGenerateCyclePlanV3 — préset full-body', () => {
  for (const sessions of [3, 4, 5, 6]) {
    it(`${sessions} séances : aucune séance vide`, () => {
      const plan = autoGenerateCyclePlanV3(balancedState(sessions, PRESET), catalog);
      expect(plan.days.length).toBe(sessions);
      for (const day of plan.days) {
        expect(day.exercises.length).toBeGreaterThan(0);
      }
    });

    it(`${sessions} séances : alternance respectée (pas de U/U/L/L)`, () => {
      const plan = autoGenerateCyclePlanV3(balancedState(sessions, PRESET), catalog);
      assertAlternation(plan.days.map((d) => d.label));
    });
  }
});

// =============================================================================
// 2. Cas atypique « haut du corps seul » → pas de séance jambes vide
// =============================================================================

describe('autoGenerateCyclePlanV3 — haut du corps seul (4×)', () => {
  const upperOnly = rawState(4, [
    'pectoraux',
    'dos_largeur',
    'deltos_lateraux',
    'biceps',
    'triceps',
  ]);

  it('aucune séance vide (Push/Pull plutôt qu\'un U/L aux jambes vides)', () => {
    const plan = autoGenerateCyclePlanV3(upperOnly, catalog);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it('aucun jour de type « lower/legs » (pas de muscle de jambe demandé)', () => {
    const plan = autoGenerateCyclePlanV3(upperOnly, catalog);
    const kinds = plan.days.map((d) => kindOf(d.label));
    expect(kinds).not.toContain('lower');
    expect(kinds).not.toContain('legs');
  });

  it('chaque muscle prioritaire est couvert ≥ 1 fois', () => {
    const plan = autoGenerateCyclePlanV3(upperOnly, catalog);
    for (const muscle of Object.keys(upperOnly.muscle_goals)) {
      const covered = plan.days.some((d) =>
        d.exercises.some(
          (p) =>
            catalog.has(p.exercise_id) &&
            exercisePrimaires(catalog.get(p.exercise_id)).includes(muscle),
        ),
      );
      expect(covered).toBe(true);
    }
  });
});

// =============================================================================
// 3. Déterminisme : régénération fin de cycle == structure onboarding
// =============================================================================

describe('autoGenerateCyclePlanV3 — déterministe (merge des voies)', () => {
  it('deux générations du même état donnent la même structure', () => {
    const state = balancedState(4, PRESET);
    const a = autoGenerateCyclePlanV3(state, catalog);
    const b = autoGenerateCyclePlanV3(state, catalog);
    expect(a.days.map((d) => d.label)).toEqual(b.days.map((d) => d.label));
  });
});

// =============================================================================
// 4. splitAlternationOk — invariant sur le catalogue
// =============================================================================

describe('splitAlternationOk', () => {
  it('tous les splits du catalogue respectent l\'alternance', () => {
    for (const split of ALL_SPLITS) {
      expect(splitAlternationOk(split)).toBe(true);
    }
  });
});
