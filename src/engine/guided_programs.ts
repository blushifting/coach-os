/**
 * Programmes guidés (prefab) — bibliothèque V1.
 *
 * Port 1:1 de prototype/coach_os/guided_programs.py (cf. 09_programmation.md §7).
 *
 * 5 programmes V1 :
 * 1. Starting Strength (Rippetoe) — débutant pur, 3×/sem, FORCE
 * 2. GreySkull LP (Sheaffer) — débutant/inter, 3×/sem, FORCE+HYP via AMRAP
 * 3. Upper/Lower Helms — intermédiaire, 4×/sem, équilibré
 * 4. 5/3/1 Boring But Big (Wendler) — inter/avancé, 4×/sem, FORCE+HYP
 * 5. PPL Hypertrophy (Nippard) — avancé, 6×/sem, HYPERTROPHIE
 */

import type { Catalog } from './catalog';
import type {
  CanonicalExercise,
  DayTemplate,
  Exercise,
  GuidedProgram,
  PlannedExercise,
  Profile,
  WeeklyTemplate,
} from './models';
import {
  Level,
  MuscleObjective,
  ProgressionRule,
  exercisePrimaires,
  makeCanonicalExercise,
  makePlannedExercise,
  makeWeeklyTemplate,
} from './models';

// =============================================================================
// Helpers de construction
// =============================================================================

function ce(input: {
  role: string;
  preferred_id: string;
  fallback_subst?: readonly string[];
  sets: number;
  reps_scheme: string;
  intensity_scheme: string;
  is_replaceable?: boolean;
}): CanonicalExercise {
  return makeCanonicalExercise({
    role: input.role,
    preferred_id: input.preferred_id,
    fallback_subst: input.fallback_subst ?? [],
    sets: input.sets,
    reps_scheme: input.reps_scheme,
    intensity_scheme: input.intensity_scheme,
    is_replaceable: input.is_replaceable,
  });
}

// =============================================================================
// 1. Starting Strength
// =============================================================================

export const STARTING_STRENGTH: GuidedProgram = Object.freeze({
  id: 'ss',
  name: 'Starting Strength',
  author: 'Mark Rippetoe',
  source: 'Practical Programming for Strength Training, 3rd ed (2014)',
  sessions_per_week: 3,
  public_cible: Object.freeze([Level.DEBUTANT]),
  objectifs_principaux: Object.freeze([MuscleObjective.FORCE]),
  cycle_length_weeks: 4,
  progression_rule: ProgressionRule.LINEAR_2_5KG,
  days: Object.freeze([
    {
      label: 'Workout A',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'smith_squat'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_press', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_pull', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 1, reps_scheme: '1x5',
          intensity_scheme: 'linear_+5kg', is_replaceable: false,
        }),
      ]),
    },
    {
      label: 'Workout B',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'smith_squat'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_ohp', preferred_id: 'ohp_bb_standing',
          fallback_subst: ['ohp_bb_seated', 'ohp_db_seated'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_pull', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 1, reps_scheme: '1x5',
          intensity_scheme: 'linear_+5kg', is_replaceable: false,
        }),
      ]),
    },
    {
      label: 'Workout A2',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'smith_squat'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_press', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused'],
          sets: 3, reps_scheme: '3x5',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_pull', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 1, reps_scheme: '1x5',
          intensity_scheme: 'linear_+5kg', is_replaceable: false,
        }),
      ]),
    },
  ]),
  notes: 'Progression linéaire +2.5 kg/séance sur les compounds, +5 kg sur deadlift.',
});

// =============================================================================
// 2. GreySkull LP
// =============================================================================

export const GREYSKULL_LP: GuidedProgram = Object.freeze({
  id: 'greyskull',
  name: 'GreySkull LP',
  author: 'John Sheaffer',
  source: 'Greyskull LP: Second Edition (2012)',
  sessions_per_week: 3,
  public_cible: Object.freeze([Level.DEBUTANT, Level.INTERMEDIAIRE]),
  objectifs_principaux: Object.freeze([MuscleObjective.FORCE, MuscleObjective.HYPERTROPHIE]),
  cycle_length_weeks: 4,
  progression_rule: ProgressionRule.AMRAP_LP,
  days: Object.freeze([
    {
      label: 'A',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_press', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused'],
          sets: 3, reps_scheme: '2x5+1xAMRAP',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'smith_squat'],
          sets: 3, reps_scheme: '2x5+1xAMRAP',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'accessory_pull', preferred_id: 'pullup',
          fallback_subst: ['pullup_assisted', 'lat_pulldown'],
          sets: 3, reps_scheme: '3xAMRAP',
          intensity_scheme: 'bodyweight', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'B',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_ohp', preferred_id: 'ohp_bb_standing',
          fallback_subst: ['ohp_bb_seated', 'ohp_db_seated'],
          sets: 3, reps_scheme: '2x5+1xAMRAP',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_pull', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 1, reps_scheme: '1x5',
          intensity_scheme: 'linear_+5kg', is_replaceable: false,
        }),
        ce({
          role: 'accessory_curl', preferred_id: 'bb_curl',
          sets: 3, reps_scheme: '3x10',
          intensity_scheme: 'double_progression', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'A2',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_press', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused'],
          sets: 3, reps_scheme: '2x5+1xAMRAP',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'smith_squat'],
          sets: 3, reps_scheme: '2x5+1xAMRAP',
          intensity_scheme: 'linear_+2.5kg', is_replaceable: false,
        }),
      ]),
    },
  ]),
  notes: 'Dernier set en AMRAP (As Many Reps As Possible). Si AMRAP > 10, +5 kg sem suiv.',
});

// =============================================================================
// 3. Upper/Lower Helms
// =============================================================================

export const UL_HELMS: GuidedProgram = Object.freeze({
  id: 'ul_helms',
  name: 'Upper/Lower Helms',
  author: 'Eric Helms',
  source: 'The Muscle and Strength Pyramid: Training, 3rd ed (2019)',
  sessions_per_week: 4,
  public_cible: Object.freeze([Level.INTERMEDIAIRE]),
  objectifs_principaux: Object.freeze([MuscleObjective.FORCE, MuscleObjective.HYPERTROPHIE]),
  cycle_length_weeks: 5,
  progression_rule: ProgressionRule.ISRAETEL_VOLUME,
  days: Object.freeze([
    {
      label: 'Upper A (force)',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_press', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused', 'chest_press_machine'],
          sets: 4, reps_scheme: '4x5', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'main_pull_h', preferred_id: 'bb_row',
          fallback_subst: ['pendlay_row', 'chest_supported_db_row', 'seated_row'],
          sets: 4, reps_scheme: '4x5', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'accessory_press', preferred_id: 'bench_bb_incl30',
          fallback_subst: ['bench_bb_incl45', 'chest_press_incl_machine'],
          sets: 3, reps_scheme: '3x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
        ce({
          role: 'accessory_pull_v', preferred_id: 'lat_pulldown',
          fallback_subst: ['lat_pulldown_neutral', 'pullup_assisted'],
          sets: 3, reps_scheme: '3x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Lower A (force)',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'hack_squat'],
          sets: 4, reps_scheme: '4x5', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'main_hinge', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 3, reps_scheme: '3x5', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'accessory_quad', preferred_id: 'leg_press_45',
          fallback_subst: ['leg_press_horizontal', 'leg_extension'],
          sets: 3, reps_scheme: '3x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Upper B (hyp)',
      canonical_exercises: Object.freeze([
        ce({
          role: 'accessory_press', preferred_id: 'bench_bb_incl30',
          fallback_subst: ['bench_bb_incl45', 'chest_press_incl_machine'],
          sets: 4, reps_scheme: '4x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
        ce({
          role: 'accessory_pull', preferred_id: 'seated_row',
          fallback_subst: ['chest_supported_db_row', 'db_row'],
          sets: 4, reps_scheme: '4x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Lower B (hyp)',
      canonical_exercises: Object.freeze([
        ce({
          role: 'accessory_squat', preferred_id: 'hack_squat',
          fallback_subst: ['leg_press_45', 'smith_squat'],
          sets: 4, reps_scheme: '4x10', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
        ce({
          role: 'accessory_hams', preferred_id: 'leg_curl_lying',
          fallback_subst: ['leg_curl_seated', 'nordic_curl'],
          sets: 4, reps_scheme: '4x12', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
  ]),
  notes: 'Force en début de semaine, hypertrophie en fin. RPE-based. Cycle 4+1 (déload sem 5).',
});

// =============================================================================
// 4. 5/3/1 Boring But Big
// =============================================================================

export const WENDLER_531_BBB: GuidedProgram = Object.freeze({
  id: '531_bbb',
  name: '5/3/1 Boring But Big',
  author: 'Jim Wendler',
  source: '5/3/1: The Simplest and Most Effective Training System, 2nd ed (2015)',
  sessions_per_week: 4,
  public_cible: Object.freeze([Level.INTERMEDIAIRE, Level.AVANCE]),
  objectifs_principaux: Object.freeze([MuscleObjective.FORCE, MuscleObjective.HYPERTROPHIE]),
  cycle_length_weeks: 4,
  progression_rule: ProgressionRule.WAVE_5_3_1,
  days: Object.freeze([
    {
      label: 'Press Day',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_ohp', preferred_id: 'ohp_bb_standing',
          fallback_subst: ['ohp_bb_seated', 'ohp_db_seated'],
          sets: 3, reps_scheme: '5/3/1+',
          intensity_scheme: 'TM*0.65/0.75/0.85', is_replaceable: false,
        }),
        ce({
          role: 'bbb_ohp', preferred_id: 'ohp_bb_standing',
          fallback_subst: ['ohp_db_seated'],
          sets: 5, reps_scheme: '5x10', intensity_scheme: 'TM*0.50',
        }),
      ]),
    },
    {
      label: 'Deadlift Day',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_deadlift', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 3, reps_scheme: '5/3/1+',
          intensity_scheme: 'TM*0.65/0.75/0.85', is_replaceable: false,
        }),
        ce({
          role: 'bbb_deadlift', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo'],
          sets: 5, reps_scheme: '5x10', intensity_scheme: 'TM*0.50',
        }),
      ]),
    },
    {
      label: 'Bench Day',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_bench', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused'],
          sets: 3, reps_scheme: '5/3/1+',
          intensity_scheme: 'TM*0.65/0.75/0.85', is_replaceable: false,
        }),
        ce({
          role: 'bbb_bench', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_incl30'],
          sets: 5, reps_scheme: '5x10', intensity_scheme: 'TM*0.50',
        }),
      ]),
    },
    {
      label: 'Squat Day',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high'],
          sets: 3, reps_scheme: '5/3/1+',
          intensity_scheme: 'TM*0.65/0.75/0.85', is_replaceable: false,
        }),
        ce({
          role: 'bbb_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high'],
          sets: 5, reps_scheme: '5x10', intensity_scheme: 'TM*0.50',
        }),
      ]),
    },
  ]),
  notes: 'TM = Training Max = 90% du 1RM réel. Ondulations 5/3/1, BBB = volume @ 50% TM.',
});

// =============================================================================
// 5. PPL Hypertrophy (Nippard)
// =============================================================================

export const PPL_NIPPARD: GuidedProgram = Object.freeze({
  id: 'ppl_nippard',
  name: 'PPL Hypertrophy (Nippard)',
  author: 'Jeff Nippard',
  source: 'Push Pull Legs Hypertrophy Program (2020)',
  sessions_per_week: 6,
  public_cible: Object.freeze([Level.AVANCE]),
  objectifs_principaux: Object.freeze([MuscleObjective.HYPERTROPHIE]),
  cycle_length_weeks: 5,
  progression_rule: ProgressionRule.ISRAETEL_VOLUME,
  days: Object.freeze([
    {
      label: 'Push A',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_bench', preferred_id: 'bench_bb',
          fallback_subst: ['bench_bb_paused', 'chest_press_machine'],
          sets: 4, reps_scheme: '4x6-8', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'incline_press', preferred_id: 'bench_bb_incl30',
          fallback_subst: ['bench_bb_incl45', 'chest_press_incl_machine'],
          sets: 3, reps_scheme: '3x8-12', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'lateral_raise', preferred_id: 'lateral_machine',
          sets: 4, reps_scheme: '4x12-15', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
        ce({
          role: 'triceps', preferred_id: 'triceps_pushdown_rope',
          fallback_subst: ['triceps_pushdown_bar'],
          sets: 3, reps_scheme: '3x12-15', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Pull A',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_pull_v', preferred_id: 'pullup',
          fallback_subst: ['lat_pulldown', 'pullup_assisted'],
          sets: 4, reps_scheme: '4x6-10', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'row', preferred_id: 'seated_row',
          fallback_subst: ['chest_supported_db_row', 'bb_row'],
          sets: 3, reps_scheme: '3x8-12', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'curl', preferred_id: 'bb_curl',
          sets: 3, reps_scheme: '3x10-12', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Legs A',
      canonical_exercises: Object.freeze([
        ce({
          role: 'main_squat', preferred_id: 'squat_bb_low',
          fallback_subst: ['squat_bb_high', 'hack_squat'],
          sets: 4, reps_scheme: '4x6-8', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'hams', preferred_id: 'leg_curl_lying',
          fallback_subst: ['leg_curl_seated', 'nordic_curl'],
          sets: 4, reps_scheme: '4x10-12', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
        ce({
          role: 'quads', preferred_id: 'leg_extension',
          sets: 3, reps_scheme: '3x12-15', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Push B',
      canonical_exercises: Object.freeze([
        ce({
          role: 'incline_press', preferred_id: 'bench_bb_incl30',
          fallback_subst: ['bench_bb_incl45', 'chest_press_incl_machine'],
          sets: 4, reps_scheme: '4x6-10', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'ohp', preferred_id: 'ohp_bb_seated',
          fallback_subst: ['ohp_db_seated', 'ohp_bb_standing'],
          sets: 3, reps_scheme: '3x8-12', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'lateral_raise', preferred_id: 'lateral_machine',
          sets: 4, reps_scheme: '4x12-15', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Pull B',
      canonical_exercises: Object.freeze([
        ce({
          role: 'row_hor', preferred_id: 'chest_supported_db_row',
          fallback_subst: ['seated_row', 'db_row'],
          sets: 4, reps_scheme: '4x8-10', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'lat_pulldown', preferred_id: 'lat_pulldown_neutral',
          fallback_subst: ['lat_pulldown'],
          sets: 3, reps_scheme: '3x10-12', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
      ]),
    },
    {
      label: 'Legs B',
      canonical_exercises: Object.freeze([
        ce({
          role: 'hinge', preferred_id: 'deadlift_conv',
          fallback_subst: ['deadlift_sumo', 'deadlift_trap_bar'],
          sets: 3, reps_scheme: '3x5', intensity_scheme: 'RPE_8',
        }),
        ce({
          role: 'quads', preferred_id: 'hack_squat',
          fallback_subst: ['leg_press_45', 'leg_press_horizontal'],
          sets: 4, reps_scheme: '4x10-12', intensity_scheme: 'RPE_8', is_replaceable: true,
        }),
        ce({
          role: 'calves', preferred_id: 'calf_standing',
          fallback_subst: ['calf_seated', 'calf_leg_press'],
          sets: 4, reps_scheme: '4x12-15', intensity_scheme: 'RPE_9', is_replaceable: true,
        }),
      ]),
    },
  ]),
  notes: '6 jours, focus hypertrophie. Reps fourchettes, RPE 8-9 sur les accessoires.',
});

// =============================================================================
// Bibliothèque
// =============================================================================

export const ALL_GUIDED_PROGRAMS: readonly GuidedProgram[] = Object.freeze([
  STARTING_STRENGTH,
  GREYSKULL_LP,
  UL_HELMS,
  WENDLER_531_BBB,
  PPL_NIPPARD,
]);

export function getGuidedProgram(programId: string): GuidedProgram | null {
  for (const p of ALL_GUIDED_PROGRAMS) {
    if (p.id === programId) return p;
  }
  return null;
}

// =============================================================================
// Substitution
// =============================================================================

function isCompatibleWithEquipment(exercise: Exercise, equipment: Set<string>): boolean {
  if (exercise.equip.length === 0) return true; // bodyweight pur
  for (const e of exercise.equip) {
    if (!equipment.has(e)) return false;
  }
  return true;
}

/**
 * Cherche dans cet ordre : preferred_id → fallback_subst → null.
 * Renvoie le 1er exo compatible avec l'équipement.
 */
export function pickSubstitution(
  canon: CanonicalExercise,
  equipment: Set<string>,
  catalog: Catalog,
): Exercise | null {
  if (catalog.has(canon.preferred_id)) {
    const pref = catalog.get(canon.preferred_id);
    if (isCompatibleWithEquipment(pref, equipment)) return pref;
  }
  for (const sid of canon.fallback_subst) {
    if (!catalog.has(sid)) continue;
    const ex = catalog.get(sid);
    if (isCompatibleWithEquipment(ex, equipment)) return ex;
  }
  return null;
}

/**
 * Cherche dans le `groupe_substitution` large du catalogue.
 * Utilisé quand le fallback strict du programme guidé n'a rien donné ET
 * que canon.is_replaceable=true.
 */
export function findLooseReplacement(
  canon: CanonicalExercise,
  equipment: Set<string>,
  catalog: Catalog,
): Exercise | null {
  if (!catalog.has(canon.preferred_id)) return null;
  const pref = catalog.get(canon.preferred_id);
  const group = catalog.in_substitution_group(pref.subst);
  for (const ex of group) {
    if (ex.id === pref.id) continue;
    if (isCompatibleWithEquipment(ex, equipment)) return ex;
  }
  return null;
}

// =============================================================================
// Fitting d'un programme guidé
// =============================================================================

/** Progression hebdo en séries pour 1 exo, sur 5 semaines. */
function computeProgression(canon: CanonicalExercise, rule: ProgressionRule): number[] {
  const base = canon.sets;
  if (rule === ProgressionRule.LINEAR_2_5KG) {
    return [base, base, base, base, Math.max(1, Math.floor(base / 2))];
  }
  if (rule === ProgressionRule.WAVE_5_3_1) {
    return [base, base, base, Math.max(1, Math.floor(base / 2)), Math.max(1, Math.floor(base / 2))];
  }
  if (rule === ProgressionRule.AMRAP_LP) {
    return [base, base, base, base, Math.max(1, Math.floor(base / 2))];
  }
  // ISRAETEL_VOLUME (Helms, PPL Nippard) : monte en séries
  const progression: number[] = [];
  for (let w = 1; w <= 4; w++) {
    progression.push(base + (w - 1));
  }
  progression.push(Math.max(1, Math.floor(base * 0.5)));
  return progression;
}

export interface FitGuidedResult {
  weekly: WeeklyTemplate | null;
  blocking: string[];
}

/**
 * Adapte un GuidedProgram au profil utilisateur.
 *
 * Si `blocking` n'est pas vide, `weekly` est null.
 */
export function fitGuidedProgram(
  program: GuidedProgram,
  _profile: Profile,
  equipment: Set<string>,
  _plafonds: Record<string, number>,
  catalog: Catalog,
  cycle_index = 1,
): FitGuidedResult {
  const week = makeWeeklyTemplate({
    cycle_index,
    rationale: program.name,
    days: [],
  });
  const blocking: string[] = [];

  for (const gday of program.days) {
    const day: DayTemplate = {
      day_index: week.days.length,
      label: gday.label,
      target_muscles_focus: [],
      exercises: [],
    };
    for (const canon of gday.canonical_exercises) {
      let ex = pickSubstitution(canon, equipment, catalog);
      if (ex === null) {
        if (!canon.is_replaceable) {
          blocking.push(
            `${canon.role} requis (${canon.preferred_id}), ` +
            `pas de substitution dispo avec ton équipement`,
          );
          continue;
        }
        ex = findLooseReplacement(canon, equipment, catalog);
        if (ex === null) {
          week.warnings.push(
            `Aucun remplaçant trouvé pour ${canon.role} (${canon.preferred_id})`,
          );
          continue;
        }
        week.warnings.push(`${canon.role} : remplacé par ${ex.id} (fallback large)`);
      }

      const planned: PlannedExercise = makePlannedExercise({
        exercise_id: ex.id,
        base_sets: canon.sets,
        progression: computeProgression(canon, program.progression_rule),
        role: canon.role,
        intensity_scheme: canon.intensity_scheme,
        progression_rule: program.progression_rule,
      });
      day.exercises.push(planned);
      for (const m of exercisePrimaires(ex)) {
        if (!day.target_muscles_focus.includes(m)) {
          day.target_muscles_focus.push(m);
        }
      }
    }
    week.days.push(day);
  }

  if (blocking.length > 0) {
    return { weekly: null, blocking };
  }

  return { weekly: week, blocking: [] };
}
