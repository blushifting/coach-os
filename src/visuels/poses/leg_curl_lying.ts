import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Leg curl couché.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const leg_curl_lying: PoseExercice = {
  id: 'leg_curl_lying',
  camera: { tour: 110, hauteur: 16 },
  mainFermee: true,
  materiel: [{ type: 'legCurlCouche', pos: [0, 0, 0], tour: 0, course: [4, 100] }],
  cles: [
    pose({
      bassin: { pos: [0, 70, 2], bascule: 90 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      bras: { cible: { repere: 'monde', pos: [24, 50, 74], axe: [0, 1, 0], pole: [1, 0.3, -0.5] } },
      jambe: { cible: { pos: [10, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
    }),
    pose({
      bassin: { pos: [0, 70, 2], bascule: 90 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      bras: { cible: { repere: 'monde', pos: [24, 50, 74], axe: [0, 1, 0], pole: [1, 0.3, -0.5] } },
      jambe: { cible: { pos: [10, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
