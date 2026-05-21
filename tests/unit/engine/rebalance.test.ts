/**
 * Tests de `rebalanceCycleDurations` (Conv #16-2).
 *
 * Stratégie :
 *  - Tests unitaires sur des templates artisanaux pour valider les
 *    invariants (jour non vide, pas de doublon, fréquence préservée).
 *  - Tests d'intégration via `generateCyclePlan` sur les 3 splits types
 *    (full-body 3j, UL 4j, PPL 6j) pour vérifier que la variance baisse
 *    et que le `slot_kind` n'est jamais cassé.
 */

import { describe, expect, it } from 'vitest';
import { Catalog } from '@/engine/catalog';
import {
  MAX_REBALANCE_ITERATIONS,
  MIN_REBALANCE_GAIN_MIN,
  rebalanceCycleDurations,
} from '@/engine/rebalance';
import { generateCyclePlan } from '@/engine/cycle_planner';
import { selectSplit, SlotKind } from '@/engine/split';
import { parameterizeSplit } from '@/engine/cycle_planner';
import { startUser } from '@/engine/engine';
import { analyzeProgramTension } from '@/lib/onboarding-preview';
import {
  exercisePrimaires,
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

describe('rebalance via generateCyclePlan — full-body 3j', () => {
  it('réduit la variance de durée entre les 3 jours (Conv #16-2)', () => {
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
    const template = generateCyclePlan(state, catalog);

    const tension = analyzeProgramTension(template, catalog);
    const nonEmpty = tension.durationsMin.filter((d) => d > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
    const spread = Math.max(...nonEmpty) - Math.min(...nonEmpty);

    // Spread devrait être notablement réduit. Sans rebalance, le scenario
    // Azur tournait à 58/39/31 = 27 min de spread. Avec rebalance + l'algo
    // de coût d'exos de Conv #15-11, on vise < 15 min.
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
    const template = generateCyclePlan(state, catalog);

    // Pour chaque muscle prioritaire, vérifie qu'il est travaillé sur
    // ≥ 2 jours différents (cible bootstrap pour 3 séances/sem).
    const priorities = Object.entries(state.muscle_goals)
      .filter(([, g]) => g.status === 'PRIORITAIRE')
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
// Intégration : UL 4j (intra slot_kind respecté)
// =============================================================================

describe('rebalance via generateCyclePlan — UL 4j', () => {
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

    // On a besoin du slot_kind par jour pour vérifier.
    const split = selectSplit(
      state.profile.sessions_per_week,
      state.muscle_goals,
      state.profile.level,
    );
    const daysMeta = parameterizeSplit(split, state.muscle_goals, state);
    const template = generateCyclePlan(state, catalog);

    expect(template.days.length).toBe(daysMeta.length);

    // Pour chaque jour LOWER, aucun exo dont muscle primaire = pectoraux
    // ou bras (catégoriquement UPPER). Et inverse pour UPPER.
    for (let i = 0; i < template.days.length; i++) {
      const kind = daysMeta[i]!.slot_kind;
      for (const ex of template.days[i]!.exercises) {
        if (!catalog.has(ex.exercise_id)) continue;
        const primaires = exercisePrimaires(catalog.get(ex.exercise_id));
        if (kind === SlotKind.LOWER) {
          // Aucun pec/dos/bras/épaule en LOWER.
          expect(primaires).not.toContain('pectoraux');
          expect(primaires).not.toContain('biceps');
          expect(primaires).not.toContain('triceps');
        } else if (kind === SlotKind.UPPER) {
          // Aucun quad/ischio/fessier en UPPER.
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
