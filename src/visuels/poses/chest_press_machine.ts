import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const chest_press_machine: PoseExercice = {
  id: 'chest_press_machine',
  camera: { tour: 40, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'couche', course: [-8, 28] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 66.5, -8.5], bascule: -10 },
      cou: { flex: 1 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 66.5, -8.5], bascule: -10 },
      cou: { flex: 1 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
