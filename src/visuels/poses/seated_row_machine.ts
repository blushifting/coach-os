import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Tirage horizontal machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const seated_row_machine: PoseExercice = {
  id: 'seated_row_machine',
  camera: { tour: 60, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'tirageHorizontalMachine', pos: [0, 0, 0], tour: 0, course: [14, 62] }],
  cles: [
    pose({
      bassin: { pos: [0, 61.1, -2] },
      thorax: { flex: 8 },
      cou: { flex: -6 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.4, -1, -0.4] } },
      jambe: { cible: { pos: [12, 8, 22], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 61.1, -2] },
      thorax: { flex: 8 },
      cou: { flex: -6 },
      bras: {
        clav: [-1.5, 0],
        cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.4, -0.3, -1] },
      },
      jambe: { cible: { pos: [12, 8, 22], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
