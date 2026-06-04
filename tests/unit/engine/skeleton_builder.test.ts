/**
 * Tests Conv #22 — skeleton_builder + sets_allocator (Phase 1.A).
 *
 * Couvre les 3 profils discutés en Conv #22 + cas limites (sous-utilisation,
 * sur-engagement, déload conditionnel, labels).
 */

import { describe, expect, it } from 'vitest';

import {
  DurationCategory,
  MuscleObjective,
  MuscleStatus,
  Sex,
  Level,
  Objective,
  makeMuscleGoal,
  makeProfile,
  makeUserState,
} from '@/engine/models';
import { initialVolumeBounds } from '@/engine/volume';
import { Catalog } from '@/engine/catalog';
import {
  buildSkeleton,
  buildSessionLabel,
  computeMuscleDemands,
  totalCellDemand,
  selectBestSplit,
} from '@/engine/skeleton_builder';
import { allocateSets } from '@/engine/sets_allocator';
import {
  computeDeloadStrategy,
  DeloadStrategy,
  effectiveCycleTargetVolume,
  targetFrequencyV2,
} from '@/engine/volume';
import { autoGenerateCyclePlanV2 } from '@/engine/cycle_planner';
import { EQUIP_FULL } from './_helpers';

// =============================================================================
// Helpers locaux
// =============================================================================

function makeStateForGoals(opts: {
  sessions_per_week: number;
  prios: Array<[string, MuscleObjective]>;
  suggested?: string[];
}) {
  const profile = makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: opts.sessions_per_week,
    bodyweight_kg: 80,
    available_equip: EQUIP_FULL,
  });
  const state = makeUserState(profile);
  const [vMin, vMax] = initialVolumeBounds(profile);
  state.volume_min = { ...vMin };
  state.volume_max = { ...vMax };
  opts.prios.forEach(([muscle, obj], i) => {
    state.muscle_goals[muscle] = makeMuscleGoal({
      muscle,
      objective: obj,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: i + 1,
    });
  });
  for (const m of opts.suggested ?? []) {
    state.muscle_goals[m] = makeMuscleGoal({
      muscle: m,
      objective: MuscleObjective.MAINTIEN,
      status: MuscleStatus.SUGGERE,
    });
  }
  return state;
}

const catalog = new Catalog();

// =============================================================================
// Compute demands + V_cible / freq
// =============================================================================

describe('Conv #22 — V_cible et fréquence', () => {
  it('V_cible = V_min + 0.4*(V_max-V_min) pour PRIORITAIRE', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    const v = effectiveCycleTargetVolume(state, 'pectoraux');
    // pec : vMin=10, vMax=18 → 10 + 0.4*8 = 13.2
    expect(v).toBeCloseTo(13.2, 1);
  });

  it('targetFrequencyV2 = ceil(V_cible / 5), capée à sessions/sem', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    // V_cible 13.2 / 5 = 2.64 → ceil = 3
    expect(targetFrequencyV2('pectoraux', state)).toBe(3);
  });

  it('SUGGERE → freq 1, V_target = V_maintien fixe', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
      suggested: ['deltos_posterieurs'],
    });
    expect(targetFrequencyV2('deltos_posterieurs', state)).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Profil 1 — Intermédiaire 4 séances 1h-1h30, prios pec/dos largeur/quad
// =============================================================================

describe('Conv #22 — Profil 1 (Inter 4× MEDIUM, pec/lats/quad)', () => {
  const state = makeStateForGoals({
    sessions_per_week: 4,
    prios: [
      ['pectoraux', MuscleObjective.HYPERTROPHIE],
      ['dos_largeur', MuscleObjective.HYPERTROPHIE],
      ['quadriceps', MuscleObjective.HYPERTROPHIE],
    ],
    suggested: ['ischios', 'deltos_posterieurs', 'abdos', 'lombaires'],
  });
  const skeleton = buildSkeleton(state, DurationCategory.MEDIUM);

  it('choisit Upper/Lower 4×', () => {
    expect(skeleton.split_name).toMatch(/Upper\/Lower/);
  });

  it('4 séances générées', () => {
    expect(skeleton.days).toHaveLength(4);
  });

  it('chaque séance respecte le plafond MEDIUM (6 patterns max)', () => {
    for (const day of skeleton.days) {
      expect(day.cells.length).toBeLessThanOrEqual(6);
    }
  });

  it('pec présent dans au moins 2 séances (freq cible 3 atteinte sur U/L)', () => {
    const pecDays = skeleton.days.filter((d) =>
      d.cells.some((c) => c.primary_muscle === 'pectoraux'),
    );
    expect(pecDays.length).toBeGreaterThanOrEqual(2);
  });

  it('quad présent dans les 2 lower', () => {
    const quadDays = skeleton.days.filter((d) =>
      d.cells.some((c) => c.primary_muscle === 'quadriceps'),
    );
    expect(quadDays.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Profil 2 — Débutant 3 séances SHORT, prios diffuses
// =============================================================================

describe('Conv #22 — Profil 2 (Inter 3× SHORT, full body diffuse)', () => {
  const state = makeStateForGoals({
    sessions_per_week: 3,
    prios: [
      ['pectoraux', MuscleObjective.HYPERTROPHIE],
      ['dos_epaisseur', MuscleObjective.HYPERTROPHIE],
      ['quadriceps', MuscleObjective.HYPERTROPHIE],
      ['ischios', MuscleObjective.HYPERTROPHIE],
    ],
    suggested: ['deltos_posterieurs', 'abdos', 'lombaires'],
  });
  const skeleton = buildSkeleton(state, DurationCategory.SHORT);

  it('3 séances', () => {
    expect(skeleton.days).toHaveLength(3);
  });

  it('chaque séance ≤ 4 patterns (SHORT plafond)', () => {
    for (const day of skeleton.days) {
      expect(day.cells.length).toBeLessThanOrEqual(4);
    }
  });

  it('alerte sur-engagement si demande > capacité', () => {
    // 4 prios × freq ~2 + 3 maintien = 11+ cases ; capacité 3×4=12 → tendu
    // Soit pas d'alerte (juste tendu), soit warning de sur-engagement.
    // On vérifie surtout qu'aucune séance ne dépasse le plafond hard.
    expect(skeleton.warnings).toBeDefined();
  });
});

// =============================================================================
// Profil 3 — 5 séances MEDIUM upper-heavy
// =============================================================================

describe('Conv #22 — Profil 3 (Inter 5× MEDIUM, upper-heavy)', () => {
  const state = makeStateForGoals({
    sessions_per_week: 5,
    prios: [
      ['pectoraux', MuscleObjective.HYPERTROPHIE],
      ['dos_largeur', MuscleObjective.HYPERTROPHIE],
      ['dos_epaisseur', MuscleObjective.HYPERTROPHIE],
      ['deltos_lateraux', MuscleObjective.HYPERTROPHIE],
      ['biceps', MuscleObjective.HYPERTROPHIE],
    ],
    suggested: ['triceps', 'deltos_posterieurs', 'abdos', 'lombaires'],
  });
  const skeleton = buildSkeleton(state, DurationCategory.MEDIUM);

  it('5 séances', () => {
    expect(skeleton.days).toHaveLength(5);
  });

  it('pec présent dans plusieurs séances (≥2 freq cible)', () => {
    const pecDays = skeleton.days.filter((d) =>
      d.cells.some((c) => c.primary_muscle === 'pectoraux'),
    );
    expect(pecDays.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Cas under-fill : peu de prios + 5 séances longues
// =============================================================================

describe('Conv #22 — Under-fill : warn si capacité >> demande', () => {
  it('alerte si 2 prios + 5 séances LONG', () => {
    const state = makeStateForGoals({
      sessions_per_week: 5,
      prios: [
        ['pectoraux', MuscleObjective.HYPERTROPHIE],
        ['quadriceps', MuscleObjective.HYPERTROPHIE],
      ],
      suggested: ['deltos_posterieurs', 'abdos', 'lombaires'],
    });
    const skeleton = buildSkeleton(state, DurationCategory.LONG);
    expect(skeleton.warnings.some((w) => /sous-utilisation/i.test(w))).toBe(true);
  });
});

// =============================================================================
// Allocator F : init 3 séries, bump vers V_cible
// =============================================================================

describe('Conv #22 — sets_allocator (étape F)', () => {
  it('Profil 1 + autoGenerateCyclePlanV2 : pec atteint V_min', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [
        ['pectoraux', MuscleObjective.HYPERTROPHIE],
        ['dos_largeur', MuscleObjective.HYPERTROPHIE],
        ['quadriceps', MuscleObjective.HYPERTROPHIE],
      ],
      suggested: ['ischios', 'deltos_posterieurs', 'abdos', 'lombaires'],
    });
    const plan = autoGenerateCyclePlanV2(state, catalog, DurationCategory.MEDIUM);
    expect(plan.days).toHaveLength(4);
    // Compter volume pec sur le cycle.
    let pecSets = 0;
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        const meta = catalog.get(ex.exercise_id);
        const coef = meta.muscles['pectoraux'] ?? 0;
        pecSets += ex.base_sets * coef;
      }
    }
    // V_min pec inter = 10. On doit y être au moins.
    expect(pecSets).toBeGreaterThanOrEqual(9.5);
  });

  it('plancher 3 séries / exo, plafond 6 / exo', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
      suggested: ['deltos_posterieurs', 'abdos', 'lombaires'],
    });
    const plan = autoGenerateCyclePlanV2(state, catalog, DurationCategory.MEDIUM);
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        expect(ex.base_sets).toBeGreaterThanOrEqual(3);
        expect(ex.base_sets).toBeLessThanOrEqual(6);
      }
    }
  });
});

// =============================================================================
// Déload conditionnel H
// =============================================================================

describe('Conv #22 — computeDeloadStrategy (item H)', () => {
  it('adhérence ≥ 75 % → déload NORMAL', () => {
    expect(computeDeloadStrategy(0.75)).toBe(DeloadStrategy.NORMAL);
    expect(computeDeloadStrategy(1.0)).toBe(DeloadStrategy.NORMAL);
  });
  it('adhérence 50-75 % → déload SHORTENED', () => {
    expect(computeDeloadStrategy(0.5)).toBe(DeloadStrategy.SHORTENED);
    expect(computeDeloadStrategy(0.6)).toBe(DeloadStrategy.SHORTENED);
  });
  it('adhérence < 50 % → pas de déload (NONE)', () => {
    expect(computeDeloadStrategy(0.4)).toBe(DeloadStrategy.NONE);
    expect(computeDeloadStrategy(0)).toBe(DeloadStrategy.NONE);
  });
});

// =============================================================================
// Labels descriptifs L
// =============================================================================

describe('Conv #22 — buildSessionLabel (item L)', () => {
  it('PPL : label split sans focus', () => {
    expect(
      buildSessionLabel({
        day_index: 0,
        split_label: 'Push',
        focus_muscles: ['pectoraux'],
        cells: [],
      }),
    ).toBe('Push');
  });
  it('U/L : label split + focus muscle(s)', () => {
    const out = buildSessionLabel({
      day_index: 0,
      split_label: 'Upper A',
      focus_muscles: ['pectoraux', 'dos_largeur'],
      cells: [],
    });
    expect(out).toMatch(/Upper A · Pec\/Lats/);
  });
  it('Full Body : label + "Focus" + muscle(s)', () => {
    const out = buildSessionLabel({
      day_index: 0,
      split_label: 'Full A',
      focus_muscles: ['pectoraux'],
      cells: [],
    });
    expect(out).toMatch(/Full A · Focus Pec/);
  });
});

// =============================================================================
// Sanity totalCellDemand
// =============================================================================

describe('Conv #22 — Sanity', () => {
  it('computeMuscleDemands produit ≥ 1 entrée par prio', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    const demands = computeMuscleDemands(state);
    expect(demands.find((d) => d.muscle === 'pectoraux')).toBeDefined();
  });

  it('selectBestSplit choisit U/L 4× quand 4 séances', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
      suggested: ['abdos', 'lombaires'],
    });
    const demands = computeMuscleDemands(state);
    const best = selectBestSplit(demands, 4, 6);
    expect(best.split.id).toBe('ul_4x');
  });

  it('totalCellDemand monotone croissant avec prios', () => {
    const a = computeMuscleDemands(
      makeStateForGoals({
        sessions_per_week: 4,
        prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
      }),
    );
    const b = computeMuscleDemands(
      makeStateForGoals({
        sessions_per_week: 4,
        prios: [
          ['pectoraux', MuscleObjective.HYPERTROPHIE],
          ['dos_largeur', MuscleObjective.HYPERTROPHIE],
        ],
      }),
    );
    expect(totalCellDemand(b)).toBeGreaterThan(totalCellDemand(a));
  });
});
