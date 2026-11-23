import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl biceps machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bicep_curl_machine: PoseExercice = {
  id: 'bicep_curl_machine',
  camera: { tour: 20, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'curlMachine', pos: [0, 0, 0], tour: 0, variante: 'ecarte', course: [8, 118] }],
  cles: [
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: {
        pronation: -90,
        cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 0, 1], pole: [-1, 0, 0] },
      },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64, -6] },
      cou: { flex: -4 },
      bras: {
        pronation: -90,
        cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 0, 1], pole: [-1, 0, 0] },
      },
      jambe: { cible: { pos: [12, 8, 34], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
