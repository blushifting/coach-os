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
import { bb_curl } from './bb_curl';
import { bb_row } from './bb_row';
import { bb_shrug } from './bb_shrug';
import { bulgarian_split } from './bulgarian_split';
import { calf_db_single } from './calf_db_single';
import { db_curl_alt } from './db_curl_alt';
import { db_front_raise } from './db_front_raise';
import { db_lateral_raise } from './db_lateral_raise';
import { db_shrug } from './db_shrug';
import { db_side_bend } from './db_side_bend';
import { deadlift_conv } from './deadlift_conv';
import { deadlift_trap_bar } from './deadlift_trap_bar';
import { front_squat } from './front_squat';
import { goblet_squat } from './goblet_squat';
import { good_morning } from './good_morning';
import { hammer_curl } from './hammer_curl';
import { kickback_db } from './kickback_db';
import { ohp_bb_standing } from './ohp_bb_standing';
import { overhead_db_extension } from './overhead_db_extension';
import { rdl_bb } from './rdl_bb';
import { rdl_db } from './rdl_db';
import { rear_delt_db_fly } from './rear_delt_db_fly';
import { reverse_lunge } from './reverse_lunge';
import { single_leg_rdl } from './single_leg_rdl';
import { squat_bb_high } from './squat_bb_high';
import { step_up } from './step_up';
import { t_bar_row } from './t_bar_row';
import { upright_row_db } from './upright_row_db';
import { walking_lunge } from './walking_lunge';

export const POSES: Readonly<Record<string, PoseExercice>> = {
  bb_curl,
  bb_row,
  bb_shrug,
  bulgarian_split,
  calf_db_single,
  db_curl_alt,
  db_front_raise,
  db_lateral_raise,
  db_shrug,
  db_side_bend,
  deadlift_conv,
  deadlift_trap_bar,
  front_squat,
  goblet_squat,
  good_morning,
  hammer_curl,
  kickback_db,
  ohp_bb_standing,
  overhead_db_extension,
  rdl_bb,
  rdl_db,
  rear_delt_db_fly,
  reverse_lunge,
  single_leg_rdl,
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
