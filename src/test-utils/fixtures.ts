/**
 * Fixtures partagées par les tests Conv #3.
 * Fabrique des `Profile` et `MuscleGoal` minimalistes pour bootstrap moteur.
 */

import {
  Level,
  MuscleObjective,
  MuscleStatus,
  Objective,
  Sex,
  makeMuscleGoal,
  makeProfile,
  type MuscleGoal,
  type Profile,
} from '@/engine/models';

/** Équipement complet (codes du catalogue exercises.json). */
export const EQUIP_FULL: ReadonlySet<string> = new Set([
  'bb_oly', 'db', 'bench_flat', 'bench_incl', 'bench_decl', 'rack', 'pull_bar',
  'dip_bar', 'cable_low', 'cable_high', 'cable_double', 'lat_pulldown',
  'seated_row', 'chest_press', 'pec_deck', 'leg_press', 'hack_squat', 'smith',
  'leg_curl_lying', 'leg_curl_seated', 'leg_extension', 'glute_machine',
  'calf_standing', 'calf_seated', 'lateral_machine', 'preacher',
  'back_extension', 'ab_wheel', 'assisted_pullup', 'reverse_hyper', 'glute_ham',
]);

export function makeTestProfile(overrides: Partial<Profile> = {}): Profile {
  const base = makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: 80,
    available_equip: EQUIP_FULL,
  });
  return { ...base, ...overrides };
}

export function makeTestMuscleGoals(): Record<string, MuscleGoal> {
  return {
    pectoraux: makeMuscleGoal({
      muscle: 'pectoraux',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 1,
    }),
    dos_largeur: makeMuscleGoal({
      muscle: 'dos_largeur',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 2,
    }),
    quadriceps: makeMuscleGoal({
      muscle: 'quadriceps',
      objective: MuscleObjective.HYPERTROPHIE,
      status: MuscleStatus.PRIORITAIRE,
      priority_rank: 3,
    }),
  };
}
