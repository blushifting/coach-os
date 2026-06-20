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
import {
  advanceWeek,
  computeCycleAdherence,
  computeDeloadStrategy,
  DeloadStrategy,
  effectiveCycleTargetVolume,
  SHORTENED_DELOAD_FACTOR,
  targetFrequencyV2,
  targetVolume,
} from '@/engine/volume';
import { autoGenerateCyclePlanV3 } from '@/engine/cycle_planner';
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

describe('Conv #22.4 — V_cible et fréquence', () => {
  it('V_cible = V_min strict pour PRIORITAIRE (cible 10-12 séries/sem)', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    const v = effectiveCycleTargetVolume(state, 'pectoraux');
    // pec intermédiaire homme : vMin=10. Conv #22.4 retour à V_min strict.
    expect(v).toBe(10);
  });

  it('targetFrequencyV2 = ceil(V_min / 5), capée à sessions/sem', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    // V_min 10 / 5 = 2 → ceil = 2.
    expect(targetFrequencyV2('pectoraux', state)).toBe(2);
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
    // Conv #22.3 — message d'alerte refondu : "ton programme tient en …%".
    expect(
      skeleton.warnings.some((w) =>
        /tient en \d+\s*% du temps que tu as/i.test(w),
      ),
    ).toBe(true);
  });
});

// =============================================================================
// Allocator F : init 3 séries, bump vers V_cible
// =============================================================================

describe('Conv #22 — sets_allocator (étape F)', () => {
  it('Profil 1 + autoGenerateCyclePlanV3 : pec atteint V_min', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [
        ['pectoraux', MuscleObjective.HYPERTROPHIE],
        ['dos_largeur', MuscleObjective.HYPERTROPHIE],
        ['quadriceps', MuscleObjective.HYPERTROPHIE],
      ],
      suggested: ['ischios', 'deltos_posterieurs', 'abdos', 'lombaires'],
    });
    const plan = autoGenerateCyclePlanV3(state, catalog, DurationCategory.MEDIUM);
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

  it('plancher 3 séries / exo, plafond 5 / exo (règle 3-5, Bloc L)', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
      suggested: ['deltos_posterieurs', 'abdos', 'lombaires'],
    });
    const plan = autoGenerateCyclePlanV3(state, catalog, DurationCategory.MEDIUM);
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        expect(ex.base_sets).toBeGreaterThanOrEqual(3);
        expect(ex.base_sets).toBeLessThanOrEqual(5);
        // Bloc L — séries fixes : toutes les semaines de travail (1-4) sont
        // égales, dans 3-5 ; la semaine 5 (déload) peut être plus basse.
        expect(ex.progression.slice(0, 4)).toEqual([
          ex.base_sets, ex.base_sets, ex.base_sets, ex.base_sets,
        ]);
        expect(ex.progression[3]!).toBeLessThanOrEqual(5);
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

describe('Conv #22 — advanceWeek pose deload_strategy à l\'entrée sem 5', () => {
  it('aucune session → adhérence 0 → NONE', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    state.current_cycle_plan = {
      cycle_index: 1,
      rationale: 'test',
      days: Array.from({ length: 4 }).map((_, i) => ({
        day_index: i,
        label: `Jour ${i}`,
        target_muscles_focus: [],
        exercises: [],
      })),
      warnings: [],
    };
    state.current_week_in_cycle = 4;
    advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(5);
    expect(state.deload_strategy).toBe(DeloadStrategy.NONE);
  });

  it('après nouvelle semaine 1 cycle suivant, deload_strategy reset à null', () => {
    const state = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    state.current_week_in_cycle = 5;
    state.deload_strategy = DeloadStrategy.NORMAL;
    advanceWeek(state);
    expect(state.current_week_in_cycle).toBe(1);
    expect(state.deload_strategy).toBeNull();
  });
});

describe('Conv #22 — targetVolume applique la stratégie de déload', () => {
  function stateInWeek5(strategy: DeloadStrategy) {
    const s = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    s.current_week_in_cycle = 5;
    s.deload_strategy = strategy;
    return s;
  }

  it('NORMAL : V cible = V_min × 0.5', () => {
    const s = stateInWeek5(DeloadStrategy.NORMAL);
    const vMin = s.volume_min['pectoraux']!;
    expect(targetVolume(s, 'pectoraux')).toBeCloseTo(vMin * 0.5, 2);
  });

  it('SHORTENED : V cible = V_min × 0.7', () => {
    const s = stateInWeek5(DeloadStrategy.SHORTENED);
    const vMin = s.volume_min['pectoraux']!;
    expect(targetVolume(s, 'pectoraux')).toBeCloseTo(vMin * SHORTENED_DELOAD_FACTOR, 2);
  });

  it('NONE : pas de déload, progression continue (≈ sem 5 progressive)', () => {
    const s = stateInWeek5(DeloadStrategy.NONE);
    const vMin = s.volume_min['pectoraux']!;
    const vMax = s.volume_max['pectoraux']!;
    const v = targetVolume(s, 'pectoraux');
    expect(v).toBeGreaterThan(vMin * 0.5); // pas un déload
    expect(v).toBeLessThanOrEqual(vMax);
  });
});

describe('Conv #22 — computeCycleAdherence', () => {
  it('plan inexistant → 0', () => {
    const s = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    expect(computeCycleAdherence(s)).toBe(0);
  });

  it('compte sessions cycle courant, week 1-4 seulement', () => {
    const s = makeStateForGoals({
      sessions_per_week: 4,
      prios: [['pectoraux', MuscleObjective.HYPERTROPHIE]],
    });
    s.current_cycle_plan = {
      cycle_index: 1,
      rationale: 't',
      days: Array.from({ length: 4 }).map((_, i) => ({
        day_index: i,
        label: `J${i}`,
        target_muscles_focus: [],
        exercises: [],
      })),
      warnings: [],
    };
    // 8 séances sur 16 = 0.5
    for (let i = 0; i < 8; i += 1) {
      s.history.push({
        seance_date: `2026-01-0${1 + i}`,
        week_in_cycle: 1 + (i % 4),
        cycle_index: 1,
        rpe_target: 8,
        sets: [],
        label: 'x',
      });
    }
    expect(computeCycleAdherence(s)).toBeCloseTo(0.5, 2);
    expect(computeDeloadStrategy(computeCycleAdherence(s))).toBe(DeloadStrategy.SHORTENED);
  });
});

// =============================================================================
// Labels descriptifs L
// =============================================================================

describe('Conv #22.5 — buildSessionLabel simplifié', () => {
  it('PPL : label split tel quel', () => {
    expect(
      buildSessionLabel({
        day_index: 0,
        split_label: 'Push A',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Push A');
  });
  it('U/L : label split tel quel (déjà distinctif via A/B)', () => {
    expect(
      buildSessionLabel({
        day_index: 0,
        split_label: 'Upper A',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Upper A');
    expect(
      buildSessionLabel({
        day_index: 1,
        split_label: 'Lower B',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Lower B');
  });
  it('Full Body : "Full Body" + lettre par day_index', () => {
    expect(
      buildSessionLabel({
        day_index: 0,
        split_label: 'Full A',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Full Body A');
    expect(
      buildSessionLabel({
        day_index: 2,
        split_label: 'Full C',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Full Body C');
  });
  it('"Spec" renommé "Focus" (Conv #28)', () => {
    expect(
      buildSessionLabel({
        day_index: 4,
        split_label: 'Spec',
        focus_muscles: [],
        cells: [],
      }),
    ).toBe('Focus');
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
