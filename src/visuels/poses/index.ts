/**
 * Registre des poses : une entrée par exercice posé, sous l'identifiant du
 * catalogue. Un fichier par exercice, à côté de celui-ci.
 *
 * Écrit par l'atelier des visuels à chaque enregistrement.
 *
 * Une pose non validée (`valide: false`) n'est vue que dans l'atelier : la
 * fiche de l'exercice garde ses photos tant qu'Azur ne l'a pas validée.
 */

import type { PoseExercice } from '../scene';
import { ab_wheel_rollout } from './ab_wheel_rollout';
import { bb_curl } from './bb_curl';
import { bb_row } from './bb_row';
import { bb_shrug } from './bb_shrug';
import { bicycle_crunch } from './bicycle_crunch';
import { bodyweight_squat } from './bodyweight_squat';
import { bulgarian_split } from './bulgarian_split';
import { calf_db_single } from './calf_db_single';
import { crunch_floor } from './crunch_floor';
import { db_curl_alt } from './db_curl_alt';
import { db_front_raise } from './db_front_raise';
import { db_lateral_raise } from './db_lateral_raise';
import { db_shrug } from './db_shrug';
import { db_side_bend } from './db_side_bend';
import { dead_bug } from './dead_bug';
import { deadlift_conv } from './deadlift_conv';
import { deadlift_trap_bar } from './deadlift_trap_bar';
import { dips_chest } from './dips_chest';
import { dips_triceps } from './dips_triceps';
import { front_squat } from './front_squat';
import { glute_bridge } from './glute_bridge';
import { glute_bridge_bw } from './glute_bridge_bw';
import { goblet_squat } from './goblet_squat';
import { good_morning } from './good_morning';
import { hammer_curl } from './hammer_curl';
import { hanging_leg_raise } from './hanging_leg_raise';
import { inverted_row } from './inverted_row';
import { kickback_db } from './kickback_db';
import { lying_leg_raise } from './lying_leg_raise';
import { oblique_crunch } from './oblique_crunch';
import { ohp_bb_standing } from './ohp_bb_standing';
import { overhead_db_extension } from './overhead_db_extension';
import { pullup } from './pullup';
import { pushup } from './pushup';
import { pushup_loaded } from './pushup_loaded';
import { rdl_bb } from './rdl_bb';
import { rdl_db } from './rdl_db';
import { rear_delt_db_fly } from './rear_delt_db_fly';
import { reverse_crunch } from './reverse_crunch';
import { reverse_lunge } from './reverse_lunge';
import { russian_twist } from './russian_twist';
import { single_leg_rdl } from './single_leg_rdl';
import { sissy_squat } from './sissy_squat';
import { sit_up } from './sit_up';
import { squat_bb_high } from './squat_bb_high';
import { step_up } from './step_up';
import { t_bar_row } from './t_bar_row';
import { upright_row_db } from './upright_row_db';
import { walking_lunge } from './walking_lunge';

export const POSES: Readonly<Record<string, PoseExercice>> = {
  ab_wheel_rollout,
  bb_curl,
  bb_row,
  bb_shrug,
  bicycle_crunch,
  bodyweight_squat,
  bulgarian_split,
  calf_db_single,
  crunch_floor,
  db_curl_alt,
  db_front_raise,
  db_lateral_raise,
  db_shrug,
  db_side_bend,
  dead_bug,
  deadlift_conv,
  deadlift_trap_bar,
  dips_chest,
  dips_triceps,
  front_squat,
  glute_bridge,
  glute_bridge_bw,
  goblet_squat,
  good_morning,
  hammer_curl,
  hanging_leg_raise,
  inverted_row,
  kickback_db,
  lying_leg_raise,
  oblique_crunch,
  ohp_bb_standing,
  overhead_db_extension,
  pullup,
  pushup,
  pushup_loaded,
  rdl_bb,
  rdl_db,
  rear_delt_db_fly,
  reverse_crunch,
  reverse_lunge,
  russian_twist,
  single_leg_rdl,
  sissy_squat,
  sit_up,
  squat_bb_high,
  step_up,
  t_bar_row,
  upright_row_db,
  walking_lunge,
};

/** La pose d'un exercice, si elle existe et qu'elle est validée. */
export function poseValidee(exerciseId: string): PoseExercice | null {
  const p = POSES[exerciseId];
  return p !== undefined && p.valide ? p : null;
}
