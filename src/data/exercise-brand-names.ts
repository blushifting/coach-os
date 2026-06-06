/**
 * Noms marketing des machines par marque (Conv #23, item O extension).
 *
 * Quand l'utilisateur déclare la marque de ses machines (via
 * `Profile.gym_brand`), les exos machine s'affichent avec le nom
 * commercial qu'il voit étiqueté sur la machine — **sans le nom de
 * gamme** (Selection, Aura, Eagle, Signature…) qui n'apparaît jamais en
 * gros sur la machine et n'aide pas à la reconnaître. Aucun effet algo.
 *
 * Stratégie (corrigée Conv #23 retour Azur) :
 *  - Pour la majorité des marques, les noms sont les libellés anglais
 *    standards visibles sur la machine : « Chest Press », « Pulldown »,
 *    « Leg Press »… Identiques entre Technogym / Matrix / Life Fitness /
 *    Cybex, parce que c'est vraiment ce que la machine affiche.
 *  - **Hammer Strength** a une nomenclature propre « Iso-Lateral X »
 *    qu'on garde car c'est ce qui est étiqueté sur ses machines.
 *  - **Nautilus** a un nom commercial spécifique (« Glute Drive ») pour
 *    le hip thrust qu'on garde.
 *
 * Couverture (Conv #23) : Technogym Selection (dominant en FR), Hammer
 * Strength Iso-Lateral (zones strength chaînes premium), Matrix Aura /
 * Versa (Magic Form), Life Fitness Signature, Cybex Eagle, Nautilus.
 *
 * Si une marque n'a pas de nom pour un exo donné, le résolveur tombe
 * sur le nom générique FR du catalogue (cf. `displayExerciseName`).
 */

import { GymBrand } from '@/engine/models';

export const BRAND_NAMES: Readonly<
  Record<GymBrand, Readonly<Partial<Record<string, string>>>>
> = {
  [GymBrand.NONE]: {},

  // Technogym (étiquetage Selection 700/900) — noms anglais standards
  // tels qu'ils apparaissent sur la machine.
  [GymBrand.TECHNOGYM]: {
    chest_press_machine: 'Chest Press',
    chest_press_incl_machine: 'Incline Chest Press',
    pec_deck: 'Pectoral Machine',
    lat_pulldown: 'Pulldown',
    lat_pulldown_neutral: 'Pulldown (prise neutre)',
    lat_pulldown_supin: 'Pulldown (supination)',
    lat_pulldown_wide: 'Pulldown (prise large)',
    seated_row_machine: 'Row',
    hack_squat_machine: 'Hack Squat',
    leg_press_45: 'Leg Press',
    leg_press_horizontal: 'Horizontal Leg Press',
    leg_extension: 'Leg Extension',
    leg_curl_lying: 'Leg Curl (couché)',
    leg_curl_seated: 'Leg Curl (assis)',
    leg_curl_standing: 'Leg Curl (debout)',
    hip_thrust_machine: 'Glute',
    calf_standing_machine: 'Standing Calf',
    calf_seated_machine: 'Seated Calf',
    machine_shoulder_press: 'Shoulder Press',
    machine_lateral_raise: 'Lateral Raise',
    reverse_pec_deck: 'Rear Delt',
    crunch_machine: 'Abdominal Crunch',
    bicep_curl_machine: 'Arm Curl',
    tricep_extension_machine: 'Arm Extension',
  },

  // Hammer Strength Iso-Lateral (plate-loaded). Le préfixe « Iso-Lateral »
  // est l'identité même de la machine : mouvements indépendants gauche /
  // droite, c'est marqué dessus.
  [GymBrand.HAMMER_STRENGTH]: {
    chest_press_machine: 'Iso-Lateral Chest Press',
    chest_press_incl_machine: 'Iso-Lateral Incline Press',
    lat_pulldown: 'Iso-Lateral Front Lat Pulldown',
    lat_pulldown_wide: 'Iso-Lateral Wide Pulldown',
    seated_row_machine: 'Iso-Lateral Low Row',
    hack_squat_machine: 'Plate-Loaded Linear Hack',
    leg_press_45: 'Iso-Lateral Leg Press',
    leg_extension: 'Iso-Lateral Leg Extension',
    leg_curl_lying: 'Iso-Lateral Leg Curl (couché)',
    leg_curl_seated: 'Iso-Lateral Leg Curl (assis)',
    machine_shoulder_press: 'Iso-Lateral Shoulder Press',
    machine_shrug: 'Iso-Lateral Shrug',
    bicep_curl_machine: 'Iso-Lateral Bicep Curl',
    tricep_extension_machine: 'Iso-Lateral Tricep Extension',
  },

  // Matrix (Magic Form). Étiquetage Aura / Versa retiré : sur la
  // machine on lit « Chest Press », « Pulldown »…
  [GymBrand.MATRIX]: {
    chest_press_machine: 'Chest Press',
    chest_press_incl_machine: 'Incline Chest Press',
    pec_deck: 'Pec Fly',
    lat_pulldown: 'Pulldown',
    lat_pulldown_neutral: 'Pulldown (prise neutre)',
    seated_row_machine: 'Seated Row',
    hack_squat_machine: 'Hack Squat',
    leg_press_45: 'Leg Press',
    leg_press_horizontal: 'Horizontal Leg Press',
    leg_extension: 'Leg Extension',
    leg_curl_lying: 'Lying Leg Curl',
    leg_curl_seated: 'Seated Leg Curl',
    calf_standing_machine: 'Standing Calf',
    calf_seated_machine: 'Seated Calf',
    machine_shoulder_press: 'Shoulder Press',
    machine_lateral_raise: 'Lateral Raise',
    reverse_pec_deck: 'Rear Delt Fly',
    crunch_machine: 'Abdominal',
    bicep_curl_machine: 'Bicep Curl',
    tricep_extension_machine: 'Tricep Extension',
  },

  // Life Fitness (Basic-Fit). Étiquetage Signature / Insignia retiré.
  [GymBrand.LIFE_FITNESS]: {
    chest_press_machine: 'Chest Press',
    pec_deck: 'Pectoral Fly',
    lat_pulldown: 'Pulldown',
    seated_row_machine: 'Seated Row',
    leg_press_45: 'Leg Press',
    leg_extension: 'Leg Extension',
    leg_curl_seated: 'Seated Leg Curl',
    machine_shoulder_press: 'Shoulder Press',
    reverse_pec_deck: 'Rear Delt Fly',
  },

  // Cybex (CMG, salles premium). Étiquetage Eagle / VR3 retiré.
  [GymBrand.CYBEX]: {
    chest_press_machine: 'Chest Press',
    lat_pulldown: 'Pulldown',
    seated_row_machine: 'Row',
    leg_press_45: 'Leg Press',
    leg_extension: 'Leg Extension',
    leg_curl_lying: 'Prone Leg Curl',
    machine_shoulder_press: 'Shoulder Press',
  },

  // Nautilus — Glute Drive est le nom commercial spécifique de leur
  // machine de hip thrust, on le garde.
  [GymBrand.NAUTILUS]: {
    hip_thrust_machine: 'Glute Drive',
    chest_press_machine: 'Chest Press',
    seated_row_machine: 'Row',
    leg_press_45: 'Leg Press',
  },
};
