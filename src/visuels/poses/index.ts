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
import { db_lateral_raise } from './db_lateral_raise';
import { squat_bb_high } from './squat_bb_high';

export const POSES: Readonly<Record<string, PoseExercice>> = {
  db_lateral_raise,
  squat_bb_high,
};

/** La pose d'un exercice, si elle existe et qu'elle est validée. */
export function poseValidee(exerciseId: string): PoseExercice | null {
  const p = POSES[exerciseId];
  return p !== undefined && p.valide ? p : null;
}
