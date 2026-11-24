import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Hack squat machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const hack_squat_machine: PoseExercice = {
  id: 'hack_squat_machine',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'hackSquat', pos: [0, 0, 0], tour: 0, course: [0, 38] }],
  cles: [
    pose({
      bassin: { pos: [0, 103, -7], bascule: -25 },
      cou: { flex: 10 },
      bras: { cible: { repere: 'traineau', pos: [32, 6, 18], axe: [0, 1, 0], pole: [1, -1, 0] } },
      jambe: {
        cible: { pos: [11, 8, 7], pole: [0, 0.3, 1], tour: 12, pointe: 0, repere: 'plateau' },
      },
    }),
    pose({
      bassin: { pos: [0, 68.56, 9.06], bascule: -25 },
      cou: { flex: 10 },
      bras: { cible: { repere: 'traineau', pos: [32, 6, 18], axe: [0, 1, 0], pole: [1, -1, 0] } },
      jambe: {
        cible: { pos: [11, 8, 7], pole: [0, 0.3, 1], tour: 12, pointe: 0, repere: 'plateau' },
      },
    }),
  ],
  valide: true,
  effort: 'retour',
};
