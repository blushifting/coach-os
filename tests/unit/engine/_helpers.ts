/**
 * Helpers partagés par les tests du moteur.
 *
 * En l'absence du module `engine.ts` (porté en Conv #2c), on fournit ici un
 * `startUserStub` qui reproduit la partie de `start_user` Python utilisée par
 * les tests des modules portés en Conv #2a (init des bornes de volume).
 */

import type { Profile, ProfileInput, UserState } from '@/engine/models';
import { Level, makeProfile, makeUserState, Objective, Sex } from '@/engine/models';
import { initialVolumeBounds } from '@/engine/volume';

export const EQUIP_FULL = new Set([
  'bb_oly',
  'db',
  'bench_flat',
  'bench_incl',
  'bench_decl',
  'rack',
  'pull_bar',
  'dip_bar',
  'cable_low',
  'cable_high',
  'cable_double',
  'lat_pulldown',
  'seated_row',
  'chest_press',
  'pec_deck',
  'leg_press',
  'hack_squat',
  'smith',
  'leg_curl_lying',
  'leg_curl_seated',
  'leg_extension',
  'glute_machine',
  'calf_standing',
  'calf_seated',
  'lateral_machine',
  'preacher',
  'back_extension',
  'ab_wheel',
  'assisted_pullup',
  'reverse_hyper',
  'glute_ham',
]);

export function profileIntermediaireH(): Profile {
  return makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: 80,
    available_equip: EQUIP_FULL,
  });
}

export function profileDebutantH(): Profile {
  return makeProfile({
    sex: Sex.HOMME,
    age: 22,
    level: Level.DEBUTANT,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 3,
    bodyweight_kg: 70,
    available_equip: EQUIP_FULL,
  });
}

/** Fabrique un Profile à la volée, équipement complet par défaut. */
export function profile(overrides: Partial<ProfileInput> = {}): Profile {
  return makeProfile({
    sex: Sex.HOMME,
    age: 30,
    level: Level.INTERMEDIAIRE,
    objective: Objective.HYPERTROPHIE,
    sessions_per_week: 4,
    bodyweight_kg: 80,
    available_equip: EQUIP_FULL,
    ...overrides,
  });
}

/** Reproduit l'init volume de `start_user` (le reste viendra en Conv #2c). */
export function startUserStub(p: Profile): UserState {
  const state = makeUserState(p);
  const [vMin, vMax] = initialVolumeBounds(p);
  state.volume_min = { ...vMin };
  state.volume_max = { ...vMax };
  return state;
}
