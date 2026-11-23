import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crunch machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const crunch_machine: PoseExercice = {
  id: 'crunch_machine',
  camera: { tour: 40, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'crunchMachine', pos: [0, 0, 0], tour: 0, course: [0, 45] }],
  cles: [
    pose({
      bassin: { pos: [0, 63.7, -8] },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.2, -1, 0.6] } },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 63.7, -8] },
      lombaires: { flex: 27 },
      thorax: { flex: 18 },
      cou: { flex: 6 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.2, -1, 0.6] } },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
