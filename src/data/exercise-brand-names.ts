/**
 * Noms marketing des machines par marque (Conv #23, item O extension).
 *
 * Quand l'utilisateur déclare sa salle (via `Profile.gym_brand`), les
 * exos machine s'affichent avec le nom commercial qu'il voit étiqueté
 * sur la machine, au lieu du libellé générique FR. Aucun effet algo.
 *
 * Couverture : Technogym Selection (le plus complet, dominant en FR),
 * Hammer Strength Iso-Lateral (zones strength des chaînes premium),
 * Matrix Aura/Versa (Magic Form), Life Fitness Signature/Insignia,
 * Cybex Eagle/VR3, Nautilus (glute drive principalement).
 *
 * Si une marque n'a pas de nom pour un exo donné, le résolveur tombe
 * sur le nom générique FR du catalogue (cf. `displayExerciseName`).
 *
 * Convention : nom français court tel qu'il apparaîtrait dans une fiche
 * machine FR (« Chest Press », pas « Selection 900 Chest Press »).
 * Les noms anglais courants restent en anglais (« Pulldown », « Row »…).
 */

import { GymBrand } from '@/engine/models';

export const BRAND_NAMES: Readonly<
  Record<GymBrand, Readonly<Partial<Record<string, string>>>>
> = {
  [GymBrand.NONE]: {},

  // Technogym Selection (Pulldown, Chest Press, Leg Press…)
  [GymBrand.TECHNOGYM]: {
    chest_press_machine: 'Chest Press Selection',
    chest_press_incl_machine: 'Incline Chest Press Selection',
    pec_deck: 'Pectoral Machine Selection',
    lat_pulldown: 'Pulldown Selection',
    lat_pulldown_neutral: 'Pulldown Selection (prise neutre)',
    lat_pulldown_supin: 'Pulldown Selection (supination)',
    lat_pulldown_wide: 'Pulldown Selection (prise large)',
    seated_row_machine: 'Row Selection',
    hack_squat_machine: 'Hack Squat',
    leg_press_45: 'Leg Press Selection',
    leg_press_horizontal: 'Leg Press Horizontal Selection',
    leg_extension: 'Leg Extension Selection',
    leg_curl_lying: 'Leg Curl Selection (couché)',
    leg_curl_seated: 'Leg Curl Selection (assis)',
    leg_curl_standing: 'Leg Curl Selection (debout)',
    hip_thrust_machine: 'Glute Selection',
    calf_standing_machine: 'Standing Calf Selection',
    calf_seated_machine: 'Seated Calf Selection',
    machine_shoulder_press: 'Shoulder Press Selection',
    machine_lateral_raise: 'Lateral Raise Selection',
    reverse_pec_deck: 'Rear Delt Selection',
    crunch_machine: 'Abdominal Crunch Selection',
  },

  // Hammer Strength Iso-Lateral (plate-loaded, mouvements indépendants)
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
  },

  // Matrix Aura / Versa (Magic Form)
  [GymBrand.MATRIX]: {
    chest_press_machine: 'Aura Chest Press',
    chest_press_incl_machine: 'Aura Incline Chest Press',
    pec_deck: 'Aura Pec Fly',
    lat_pulldown: 'Aura Pulldown',
    lat_pulldown_neutral: 'Aura Pulldown (prise neutre)',
    seated_row_machine: 'Aura Seated Row',
    hack_squat_machine: 'Aura Hack Squat',
    leg_press_45: 'Aura Leg Press',
    leg_press_horizontal: 'Aura Horizontal Leg Press',
    leg_extension: 'Aura Leg Extension',
    leg_curl_lying: 'Aura Lying Leg Curl',
    leg_curl_seated: 'Aura Seated Leg Curl',
    calf_standing_machine: 'Aura Standing Calf',
    calf_seated_machine: 'Aura Seated Calf',
    machine_shoulder_press: 'Aura Shoulder Press',
    machine_lateral_raise: 'Aura Lateral Raise',
    reverse_pec_deck: 'Aura Rear Delt Fly',
    crunch_machine: 'Aura Abdominal',
  },

  // Life Fitness Signature / Insignia (Basic-Fit)
  [GymBrand.LIFE_FITNESS]: {
    chest_press_machine: 'Signature Chest Press',
    pec_deck: 'Signature Pectoral Fly',
    lat_pulldown: 'Signature Pulldown',
    seated_row_machine: 'Signature Seated Row',
    leg_press_45: 'Signature Leg Press',
    leg_extension: 'Signature Leg Extension',
    leg_curl_seated: 'Signature Seated Leg Curl',
    machine_shoulder_press: 'Signature Shoulder Press',
    reverse_pec_deck: 'Signature Rear Delt Fly',
  },

  // Cybex Eagle / VR3 (CMG, salles premium)
  [GymBrand.CYBEX]: {
    chest_press_machine: 'Eagle Chest Press',
    lat_pulldown: 'Eagle Pulldown',
    seated_row_machine: 'Eagle Row',
    leg_press_45: 'Eagle Leg Press',
    leg_extension: 'Eagle Leg Extension',
    leg_curl_lying: 'Eagle Prone Leg Curl',
    machine_shoulder_press: 'Eagle Shoulder Press',
  },

  // Nautilus (glute drive principalement)
  [GymBrand.NAUTILUS]: {
    hip_thrust_machine: 'Nautilus Glute Drive',
    chest_press_machine: 'Nautilus Chest Press',
    seated_row_machine: 'Nautilus Row',
    leg_press_45: 'Nautilus Leg Press',
  },
};
