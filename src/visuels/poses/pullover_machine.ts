import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pullover machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pullover_machine: PoseExercice = {
  id: 'pullover_machine',
  camera: { tour: 60, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'pulloverMachine', pos: [0, 0, 0], tour: 0, course: [78, -30] }],
  cles: [
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'barre', pos: [20, 0, 0], axe: [1, 0, 0], pole: [1, 0, 0] } },
      jambe: { cible: { pos: [12, 8, 36], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'barre', pos: [20, 0, 0], axe: [1, 0, 0], pole: [1, 0, 0] } },
      jambe: { cible: { pos: [12, 8, 36], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
