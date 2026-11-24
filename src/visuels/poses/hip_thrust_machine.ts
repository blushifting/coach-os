import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Hip thrust machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const hip_thrust_machine: PoseExercice = {
  id: 'hip_thrust_machine',
  camera: { tour: 75, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'hipThrustMachine', pos: [0, 0, 0], tour: 0, course: [-60, -75, -90] }],
  cles: [
    pose({
      bassin: { pos: [0, 33.5, 4.44], bascule: -60 },
      cou: { flex: 30 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.3, 0, 1] } },
      jambe: { cible: { pos: [11, 13, 40], pole: [0, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 45.32, 9.33], bascule: -75 },
      thorax: { flex: -2.57 },
      cou: { flex: 24 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.3, 0, 1] } },
      jambe: { cible: { pos: [11, 13, 40], pole: [0, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58, 11], bascule: -90 },
      thorax: { flex: -5.14 },
      cou: { flex: 18 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.3, 0, 1] } },
      jambe: { cible: { pos: [11, 13, 40], pole: [0, 1, 0.4], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
