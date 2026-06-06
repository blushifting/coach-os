/**
 * Mapping Coach OS exercise_id -> free-exercise-db exercise_id (Conv #23,
 * item W).
 *
 * free-exercise-db (https://github.com/yuhonas/free-exercise-db) est en
 * **domaine public** (licence Unlicense). On référence directement les
 * images hébergées sur raw.githubusercontent.com — pas de copie locale,
 * pas de bundle inflate. Le navigateur lazy-load à la 1re consultation
 * d'une fiche exo, et le Service Worker met en cache pour les sessions
 * suivantes (offline-first à la salle après 1re vue).
 *
 * Chaque exo free-db expose 2 frames JPG (~70 KB chacun, 850×567) :
 * frame 0 = position de départ, frame 1 = position d'arrivée. Le
 * composant `ExercisePhoto` alterne entre les 2 pour donner un effet
 * GIF-like du mouvement.
 *
 * Couverture : 131/131 exos Coach OS mappés (après suppression Conv #23
 * des 10 exos sans photo disponible : seal_row, cable_woodchopper,
 * cable_pallof_press, jefferson_curl, lu_raise, bench_bb_paused,
 * pendlay_row, pendulum_squat, good_morning_machine, nordic_curl).
 *
 * Certaines variantes Coach OS pointent vers la même image free-db
 * (ex. lat_pulldown / lat_pulldown_supin → Wide-Grip_Lat_Pulldown) : la
 * différence porte sur la prise, pas sur le mouvement global, l'image
 * du parent reste pertinente.
 */

const FREE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** Mapping Coach OS id -> free-exercise-db id. */
const FREE_DB_MAP: Readonly<Record<string, string>> = {
  ab_wheel_rollout: 'Ab_Roller',
  arnold_press: 'Arnold_Dumbbell_Press',
  back_extension_45: 'Hyperextensions_Back_Extensions',
  back_extension_horizontal: 'Hyperextensions_Back_Extensions',
  bb_curl: 'Barbell_Curl',
  bb_glute_bridge: 'Barbell_Glute_Bridge',
  bb_row: 'Bent_Over_Barbell_Row',
  bb_shrug: 'Barbell_Shrug',
  bench_bb: 'Barbell_Bench_Press_-_Medium_Grip',
  bench_bb_close: 'Close-Grip_Barbell_Bench_Press',
  bench_bb_decl: 'Decline_Barbell_Bench_Press',
  bench_bb_incl30: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  bench_bb_incl45: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  bench_db: 'Dumbbell_Bench_Press',
  bench_db_decl: 'Decline_Dumbbell_Bench_Press',
  bench_db_incl30: 'Incline_Dumbbell_Press',
  bulgarian_split: 'Split_Squat_with_Dumbbells',
  cable_crossover_high: 'Cable_Crossover',
  cable_crossover_low: 'Low_Cable_Crossover',
  cable_crossover_mid: 'Cable_Crossover',
  cable_crunch: 'Cable_Crunch',
  cable_curl: 'Standing_Biceps_Cable_Curl',
  cable_kickback: 'Glute_Kickback',
  cable_lateral_raise: 'Side_Lateral_Raise',
  cable_pull_through: 'Pull_Through',
  cable_pullover: 'Bent-Arm_Dumbbell_Pullover',
  cable_pushdown_v_bar: 'Triceps_Pushdown_-_V-Bar_Attachment',
  cable_rear_delt_fly: 'Cable_Rear_Delt_Fly',
  cable_row: 'Seated_Cable_Rows',
  cable_row_neutral: 'Seated_Cable_Rows',
  cable_row_wide: 'Seated_Cable_Rows',
  cable_shrug: 'Cable_Shrugs',
  calf_db_single: 'Standing_Calf_Raises',
  calf_leg_press: 'Calf_Press_On_The_Leg_Press_Machine',
  calf_seated_machine: 'Seated_Calf_Raise',
  calf_smith: 'Smith_Machine_Calf_Raise',
  calf_standing_machine: 'Standing_Calf_Raises',
  captains_chair_leg_raise: 'Hanging_Leg_Raise',
  chest_press_incl_machine: 'Smith_Machine_Incline_Bench_Press',
  chest_press_machine: 'Machine_Bench_Press',
  chest_supported_db_row: 'Bent_Over_Two-Dumbbell_Row',
  chest_supported_rear_fly: 'Seated_Bent-Over_Rear_Delt_Raise',
  chinup: 'Chin-Up',
  close_grip_bench: 'Close-Grip_Barbell_Bench_Press',
  concentration_curl: 'Concentration_Curls',
  crunch_floor: 'Crunches',
  crunch_machine: 'Ab_Crunch_Machine',
  db_curl_alt: 'Alternate_Hammer_Curl',
  db_fly_flat: 'Dumbbell_Flyes',
  db_fly_incl: 'Incline_Dumbbell_Flyes',
  db_lateral_raise: 'Side_Lateral_Raise',
  db_pullover: 'Bent-Arm_Dumbbell_Pullover',
  db_row: 'One-Arm_Dumbbell_Row',
  db_shrug: 'Dumbbell_Shrug',
  db_side_bend: 'Dumbbell_Side_Bend',
  deadlift_conv: 'Barbell_Deadlift',
  deadlift_sumo: 'Sumo_Deadlift',
  deadlift_trap_bar: 'Trap_Bar_Deadlift',
  dips_chest: 'Dips_-_Chest_Version',
  dips_triceps: 'Weighted_Bench_Dip',
  ez_curl: 'EZ-Bar_Curl',
  face_pull: 'Face_Pull',
  french_press_ez: 'EZ-Bar_Skullcrusher',
  front_squat: 'Front_Barbell_Squat',
  ghr: 'Glute_Ham_Raise',
  glute_bridge: 'Barbell_Glute_Bridge',
  goblet_squat: 'Goblet_Squat',
  good_morning: 'Good_Morning',
  hack_squat_machine: 'Hack_Squat',
  hammer_curl: 'Hammer_Curls',
  hanging_leg_raise: 'Hanging_Leg_Raise',
  hip_thrust_bb: 'Barbell_Hip_Thrust',
  hip_thrust_machine: 'Barbell_Hip_Thrust',
  incline_db_curl: 'Incline_Dumbbell_Curl',
  inverted_row: 'Inverted_Row',
  jm_press: 'JM_Press',
  kickback_db: 'Tricep_Dumbbell_Kickback',
  lat_pulldown: 'Wide-Grip_Lat_Pulldown',
  lat_pulldown_neutral: 'Close-Grip_Front_Lat_Pulldown',
  lat_pulldown_supin: 'Wide-Grip_Lat_Pulldown',
  lat_pulldown_wide: 'Wide-Grip_Lat_Pulldown',
  leg_curl_lying: 'Lying_Leg_Curls',
  leg_curl_seated: 'Seated_Leg_Curl',
  leg_curl_standing: 'Standing_Leg_Curl',
  leg_extension: 'Leg_Extensions',
  leg_press_45: 'Leg_Press',
  leg_press_horizontal: 'Leg_Press',
  lying_leg_raise: 'Flat_Bench_Lying_Leg_Raise',
  machine_lateral_raise: 'Side_Lateral_Raise',
  machine_shoulder_press: 'Machine_Shoulder_Military_Press',
  machine_shrug: 'Smith_Machine_Behind_the_Back_Shrug',
  oblique_crunch: 'Oblique_Crunches',
  ohp_bb_seated: 'Seated_Barbell_Military_Press',
  ohp_bb_standing: 'Standing_Military_Press',
  ohp_db_seated: 'Seated_Dumbbell_Press',
  overhead_cable_extension: 'Seated_Triceps_Press',
  overhead_db_extension: 'Seated_Triceps_Press',
  pec_deck: 'Butterfly',
  preacher_curl_bb: 'Preacher_Curl',
  preacher_curl_db: 'Two-Arm_Dumbbell_Preacher_Curl',
  pullup: 'Pullups',
  pullup_assisted: 'Band_Assisted_Pull-Up',
  pullup_neutral: 'Pullups',
  pushup: 'Pushups',
  pushup_loaded: 'Pushups',
  rdl_bb: 'Romanian_Deadlift',
  rdl_db: 'Romanian_Deadlift',
  rear_delt_db_fly: 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench',
  reverse_hyper: 'Reverse_Hyperextension',
  reverse_lunge: 'Dumbbell_Rear_Lunge',
  reverse_pec_deck: 'Reverse_Machine_Flyes',
  russian_twist: 'Russian_Twist',
  seated_row_machine: 'Seated_Cable_Rows',
  side_plank_loaded: 'Side_Bridge',
  single_leg_hip_thrust: 'Barbell_Hip_Thrust',
  single_leg_rdl: 'Romanian_Deadlift',
  sissy_squat: 'Weighted_Sissy_Squat',
  sit_up_decline: 'Decline_Crunch',
  smith_bench: 'Smith_Machine_Bench_Press',
  smith_squat: 'Smith_Machine_Squat',
  spider_curl: 'Spider_Curl',
  squat_bb_high: 'Barbell_Squat',
  squat_bb_low: 'Barbell_Squat',
  step_up: 'Dumbbell_Step_Ups',
  straight_arm_pulldown: 'Straight-Arm_Pulldown',
  t_bar_row: 'T-Bar_Row_with_Handle',
  triceps_pushdown_bar: 'Triceps_Pushdown',
  triceps_pushdown_rope: 'Triceps_Pushdown_-_Rope_Attachment',
  upright_row_cable: 'Upright_Cable_Row',
  upright_row_db: 'Standing_Dumbbell_Upright_Row',
  walking_lunge: 'Barbell_Walking_Lunge',
};

export interface ExercisePhotos {
  /** Frame de départ du mouvement. */
  readonly startUrl: string;
  /** Frame d'arrivée du mouvement. */
  readonly endUrl: string;
  /** id free-exercise-db pour debug / attribution. */
  readonly freeDbId: string;
}

/**
 * Résout les URLs des photos pour un exo Coach OS donné. `null` si
 * l'exo n'a pas de mapping (variantes futures, exos custom user, etc.).
 */
export function photosFor(exerciseId: string): ExercisePhotos | null {
  const freeDbId = FREE_DB_MAP[exerciseId];
  if (freeDbId === undefined) return null;
  return {
    startUrl: `${FREE_DB_BASE}/${freeDbId}/0.jpg`,
    endUrl: `${FREE_DB_BASE}/${freeDbId}/1.jpg`,
    freeDbId,
  };
}
