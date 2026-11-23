import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé épaules machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const machine_shoulder_press: PoseExercice = {
  id: 'machine_shoulder_press',
  camera: { tour: 45, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'developpeMachine', pos: [0, 0, 0], tour: 0, variante: 'epaules', course: [8, 38] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 65, -7.3], bascule: -6 },
      cou: { flex: -1 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [1, -0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 65, -7.3], bascule: -6 },
      cou: { flex: -1 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [1, 0, 0], pole: [1, -0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
