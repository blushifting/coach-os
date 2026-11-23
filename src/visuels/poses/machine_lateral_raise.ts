import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Élévations latérales machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const machine_lateral_raise: PoseExercice = {
  id: 'machine_lateral_raise',
  camera: { tour: 30, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'elevationsMachine', pos: [0, 0, 0], tour: 0, course: [8, 82] }],
  cles: [
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0, 0, -1] } },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0, 0, -1] } },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
