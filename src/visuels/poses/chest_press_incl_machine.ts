import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé incliné machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const chest_press_incl_machine: PoseExercice = {
  id: 'chest_press_incl_machine',
  camera: { tour: 45, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'incline', course: [0, 33] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 66.5, -10.7], bascule: -18 },
      cou: { flex: 5 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 66.5, -10.7], bascule: -18 },
      cou: { flex: 5 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
