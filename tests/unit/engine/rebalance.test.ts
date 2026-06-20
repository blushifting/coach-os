/**
 * Tests de `rebalanceCycleDurations` (Conv #16-2).
 *
 * Stratégie :
 *  - Tests unitaires sur des templates artisanaux pour valider les
 *    invariants (jour non vide, pas de doublon, fréquence préservée).
 *  - Tests d'intégration via `autoGenerateCyclePlanV3` (voie unique, Conv #39)
 *    pour vérifier que la variance baisse et que le `slot_kind` n'est jamais
 *    cassé (le kind est dérivé du label de séance).
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  MAX_REBALANCE_ITERATIONS,
  MIN_REBALANCE_GAIN_MIN,
  rebalanceCycleDurations,
} from '@/engine/rebalance';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
import { startUser } from '@/engine/engine';
import { analyzeProgramTension } from '@/lib/onboarding-preview';
import {
  exercisePrimaires,
  MuscleStatus,
  Objective,
  type WeeklyTemplate,
} from '@/engine/models';
import { profile } from '../engine/_helpers';
import { bootstrapMuscleGoalsFromProfile } from '@/engine/engine';

const catalog = new Catalog();

// =============================================================================
// Constantes export
// =============================================================================

describe('rebalanceCycleDurations — constantes', () => {
  it('MAX_REBALANCE_ITERATIONS = 10', () => {
    expect(MAX_REBALANCE_ITERATIONS).toBe(10);
  });
  it('MIN_REBALANCE_GAIN_MIN = 3', () => {
    expect(MIN_REBALANCE_GAIN_MIN).toBe(3);
  });
});

// =============================================================================
// Intégration : full-body 3j
// =============================================================================

describe('rebalance via autoGenerateCyclePlanV3 — 3 séances', () => {
  it('réduit la variance de durée entre les jours (Conv #16-2)', () => {
    const p = profile({
      sessions_per_week: 3,
      objective: Objective.HYPERTROPHIE,
    });
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux',
      'dos_largeur',
      'quadriceps',
      'ischios',
      'biceps',
      'triceps',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    const template = autoGenerateCyclePlanV3(state, catalog);

    const tension = analyzeProgramTension(template, catalog);
    const nonEmpty = tension.durationsMin.filter((d) => d > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
    const spread = Math.max(...nonEmpty) - Math.min(...nonEmpty);

    // Variance de durée maîtrisée entre les séances.
    expect(spread).toBeLessThanOrEqual(15);

    // Tous les jours doivent rester non vides.
    for (const day of template.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it("ne casse pas la fréquence muscle prioritaire", () => {
    const p = profile({
      sessions_per_week: 3,
      objective: Objective.HYPERTROPHIE,
    });
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux',
      'dos_largeur',
      'quadriceps',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    const template = autoGenerateCyclePlanV3(state, catalog);

    // Pour chaque muscle prioritaire, vérifie qu'il est travaillé sur
    // ≥ 2 jours différents (cible bootstrap pour 3 séances/sem).
    const priorities = Object.entries(state.muscle_goals)
      .filter(([, g]) => g.status === MuscleStatus.PRIORITAIRE)
      .map(([m]) => m);
    for (const muscle of priorities) {
      let count = 0;
      for (const day of template.days) {
        const present = day.exercises.some((ex) =>
          catalog.has(ex.exercise_id)
            ? exercisePrimaires(catalog.get(ex.exercise_id)).includes(muscle)
            : false,
        );
        if (present) count++;
      }
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });
});

// =============================================================================
// Intégration : UL 4j (slot_kind respecté, dérivé du label)
// =============================================================================

describe('rebalance via autoGenerateCyclePlanV3 — UL 4j', () => {
  it('respecte les slot_kind : aucun exo UPPER ne migre vers un jour LOWER', () => {
    const p = profile({
      sessions_per_week: 4,
      objective: Objective.HYPERTROPHIE,
    });
    const goals = bootstrapMuscleGoalsFromProfile(p, [
      'pectoraux',
      'dos_largeur',
      'quadriceps',
      'ischios',
    ]);
    const state = startUser(p, catalog, { muscleGoals: goals });
    const template = autoGenerateCyclePlanV3(state, catalog);

    // Le kind est dérivé du label de séance (Conv #39 : « Upper A », « Lower B »).
    for (const day of template.days) {
      const isUpper = /upper/i.test(day.label);
      const isLower = /lower/i.test(day.label);
      for (const ex of day.exercises) {
        if (!catalog.has(ex.exercise_id)) continue;
        const primaires = exercisePrimaires(catalog.get(ex.exercise_id));
        if (isLower) {
          expect(primaires).not.toContain('pectoraux');
          expect(primaires).not.toContain('biceps');
          expect(primaires).not.toContain('triceps');
        } else if (isUpper) {
          expect(primaires).not.toContain('quadriceps');
          expect(primaires).not.toContain('ischios');
          expect(primaires).not.toContain('fessiers');
        }
      }
    }
  });
});

// =============================================================================
// Unitaires : invariants sur input dégénéré
// =============================================================================

describe('rebalanceCycleDurations — cas limites', () => {
  it('1 seul jour → no-op (rien à rebalancer)', () => {
    const p = profile({ sessions_per_week: 3 });
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const state = startUser(p, catalog, { muscleGoals: goals });

    // Pose un template artificiel à 1 jour.
    const template: WeeklyTemplate = {
      cycle_index: 1,
      rationale: 't',
      warnings: [],
      days: [
        {
          day_index: 0,
          label: 'Solo',
          target_muscles_focus: ['pectoraux'],
          exercises: [
            {
              exercise_id: 'bench_press',
              base_sets: 3,
              progression: [3, 3, 3, 3, 2],
              role: null,
              intensity_scheme: null,
              progression_rule: null,
            },
          ],
        },
      ],
    };
    const { template: out, trace } = rebalanceCycleDurations(
      template,
      ['FULLBODY'],
      state,
      catalog,
    );
    expect(out.days).toEqual(template.days);
    expect(trace.operations).toHaveLength(0);
  });

  it('refuse une opération qui viderait un jour', () => {
    // 2 jours, l'un avec 1 seul exo. Move serait illégal (jour vide).
    const p = profile({ sessions_per_week: 2 });
    const goals = bootstrapMuscleGoalsFromProfile(p, ['pectoraux']);
    const state = startUser(p, catalog, { muscleGoals: goals });
    const template: WeeklyTemplate = {
      cycle_index: 1,
      rationale: 't',
      warnings: [],
      days: [
        {
          day_index: 0,
          label: 'A',
          target_muscles_focus: ['pectoraux'],
          exercises: [
            {
              exercise_id: 'bench_press',
              base_sets: 5,
              progression: [5, 5, 5, 5, 3],
              role: null,
              intensity_scheme: null,
              progression_rule: null,
            },
          ],
        },
        {
          day_index: 1,
          label: 'B',
          target_muscles_focus: [],
          exercises: [],
        },
      ],
    };
    const { trace } = rebalanceCycleDurations(
      template,
      ['FULLBODY', 'FULLBODY'],
      state,
      catalog,
    );
    // Move de A→B est interdit (vide A). Swap impossible (B vide).
    // → 0 opération.
    expect(trace.operations).toHaveLength(0);
  });
});
