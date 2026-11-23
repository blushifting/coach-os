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
import { arnold_press } from './arnold_press';
import { bb_curl } from './bb_curl';
import { bb_row } from './bb_row';
import { bb_shrug } from './bb_shrug';
import { bench_bb } from './bench_bb';
import { bench_bb_close } from './bench_bb_close';
import { bench_bb_decl } from './bench_bb_decl';
import { bench_bb_incl30 } from './bench_bb_incl30';
import { bench_db } from './bench_db';
import { bench_db_decl } from './bench_db_decl';
import { bench_db_incl30 } from './bench_db_incl30';
import { bicycle_crunch } from './bicycle_crunch';
import { bodyweight_squat } from './bodyweight_squat';
import { bulgarian_split } from './bulgarian_split';
import { cable_crossover_mid } from './cable_crossover_mid';
import { cable_crunch } from './cable_crunch';
import { cable_curl } from './cable_curl';
import { cable_front_raise } from './cable_front_raise';
import { cable_kickback } from './cable_kickback';
import { cable_lateral_raise } from './cable_lateral_raise';
import { cable_pull_through } from './cable_pull_through';
import { cable_pullover } from './cable_pullover';
import { cable_rear_delt_fly } from './cable_rear_delt_fly';
import { cable_row } from './cable_row';
import { cable_shrug } from './cable_shrug';
import { cable_wood_chop } from './cable_wood_chop';
import { calf_db_single } from './calf_db_single';
import { chest_supported_db_row } from './chest_supported_db_row';
import { concentration_curl } from './concentration_curl';
import { crunch_floor } from './crunch_floor';
import { db_curl_alt } from './db_curl_alt';
import { db_fly_flat } from './db_fly_flat';
import { db_front_raise } from './db_front_raise';
import { db_lateral_raise } from './db_lateral_raise';
import { db_pullover } from './db_pullover';
import { db_row } from './db_row';
import { db_shrug } from './db_shrug';
import { db_side_bend } from './db_side_bend';
import { dead_bug } from './dead_bug';
import { deadlift_conv } from './deadlift_conv';
import { deadlift_trap_bar } from './deadlift_trap_bar';
import { dips_chest } from './dips_chest';
import { dips_triceps } from './dips_triceps';
import { face_pull } from './face_pull';
import { french_press_ez } from './french_press_ez';
import { front_squat } from './front_squat';
import { glute_bridge } from './glute_bridge';
import { glute_bridge_bw } from './glute_bridge_bw';
import { goblet_squat } from './goblet_squat';
import { good_morning } from './good_morning';
import { hammer_curl } from './hammer_curl';
import { hanging_leg_raise } from './hanging_leg_raise';
import { hip_thrust_bb } from './hip_thrust_bb';
import { incline_db_curl } from './incline_db_curl';
import { inverted_row } from './inverted_row';
import { jm_press } from './jm_press';
import { kickback_db } from './kickback_db';
import { lat_pulldown } from './lat_pulldown';
import { lying_leg_raise } from './lying_leg_raise';
import { oblique_crunch } from './oblique_crunch';
import { ohp_bb_standing } from './ohp_bb_standing';
import { ohp_db_seated } from './ohp_db_seated';
import { overhead_cable_extension } from './overhead_cable_extension';
import { overhead_db_extension } from './overhead_db_extension';
import { pallof_press } from './pallof_press';
import { preacher_curl_bb } from './preacher_curl_bb';
import { preacher_curl_db } from './preacher_curl_db';
import { pullup } from './pullup';
import { pushup } from './pushup';
import { pushup_loaded } from './pushup_loaded';
import { rdl_bb } from './rdl_bb';
import { rdl_db } from './rdl_db';
import { rear_delt_db_fly } from './rear_delt_db_fly';
import { reverse_crunch } from './reverse_crunch';
import { reverse_lunge } from './reverse_lunge';
import { russian_twist } from './russian_twist';
import { single_leg_hip_thrust } from './single_leg_hip_thrust';
import { single_leg_rdl } from './single_leg_rdl';
import { sissy_squat } from './sissy_squat';
import { sit_up } from './sit_up';
import { sit_up_decline } from './sit_up_decline';
import { spider_curl } from './spider_curl';
import { squat_bb_high } from './squat_bb_high';
import { step_up } from './step_up';
import { t_bar_row } from './t_bar_row';
import { triceps_pushdown_rope } from './triceps_pushdown_rope';
import { upright_row_cable } from './upright_row_cable';
import { upright_row_db } from './upright_row_db';
import { walking_lunge } from './walking_lunge';

export const POSES: Readonly<Record<string, PoseExercice>> = {
  ab_wheel_rollout,
  arnold_press,
  bb_curl,
  bb_row,
  bb_shrug,
  bench_bb,
  bench_bb_close,
  bench_bb_decl,
  bench_bb_incl30,
  bench_db,
  bench_db_decl,
  bench_db_incl30,
  bicycle_crunch,
  bodyweight_squat,
  bulgarian_split,
  cable_crossover_mid,
  cable_crunch,
  cable_curl,
  cable_front_raise,
  cable_kickback,
  cable_lateral_raise,
  cable_pull_through,
  cable_pullover,
  cable_rear_delt_fly,
  cable_row,
  cable_shrug,
  cable_wood_chop,
  calf_db_single,
  chest_supported_db_row,
  concentration_curl,
  crunch_floor,
  db_curl_alt,
  db_fly_flat,
  db_front_raise,
  db_lateral_raise,
  db_pullover,
  db_row,
  db_shrug,
  db_side_bend,
  dead_bug,
  deadlift_conv,
  deadlift_trap_bar,
  dips_chest,
  dips_triceps,
  face_pull,
  french_press_ez,
  front_squat,
  glute_bridge,
  glute_bridge_bw,
  goblet_squat,
  good_morning,
  hammer_curl,
  hanging_leg_raise,
  hip_thrust_bb,
  incline_db_curl,
  inverted_row,
  jm_press,
  kickback_db,
  lat_pulldown,
  lying_leg_raise,
  oblique_crunch,
  ohp_bb_standing,
  ohp_db_seated,
  overhead_cable_extension,
  overhead_db_extension,
  pallof_press,
  preacher_curl_bb,
  preacher_curl_db,
  pullup,
  pushup,
  pushup_loaded,
  rdl_bb,
  rdl_db,
  rear_delt_db_fly,
  reverse_crunch,
  reverse_lunge,
  russian_twist,
  single_leg_hip_thrust,
  single_leg_rdl,
  sissy_squat,
  sit_up,
  sit_up_decline,
  spider_curl,
  squat_bb_high,
  step_up,
  t_bar_row,
  triceps_pushdown_rope,
  upright_row_cable,
  upright_row_db,
  walking_lunge,
};

/** La pose d'un exercice, si elle existe et qu'elle est validée. */
export function poseValidee(exerciseId: string): PoseExercice | null {
  const p = POSES[exerciseId];
  return p !== undefined && p.valide ? p : null;
}
