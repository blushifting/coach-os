import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Leg curl debout (uni).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const leg_curl_standing: PoseExercice = {
  id: 'leg_curl_standing',
  camera: { tour: 125, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'legCurlDebout', pos: [0, 0, 0], tour: 0, course: [8, 100] }],
  cles: [
    pose({
      bassin: { pos: [0, 106.8, 0], bascule: 35 },
      cou: { flex: -20 },
      bras: {
        cible: { repere: 'monde', pos: [24, 117, 58], axe: [0, 1, 0], pole: [1, -0.6, -0.4] },
      },
      jambeG: { cible: { pos: [0, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
      jambeD: {
        cible: { pos: [2, 8, -4.9], pole: [0, 0.3, 1], tour: 6, pointe: 0, repere: 'marche' },
      },
    }),
    pose({
      bassin: { pos: [0, 106.8, 0], bascule: 35 },
      cou: { flex: -20 },
      bras: {
        cible: { repere: 'monde', pos: [24, 117, 58], axe: [0, 1, 0], pole: [1, -0.6, -0.4] },
      },
      jambeG: { cible: { pos: [0, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
      jambeD: {
        cible: { pos: [2, 8, -4.9], pole: [0, 0.3, 1], tour: 6, pointe: 0, repere: 'marche' },
      },
    }),
  ],
  valide: true,
  cote: 'G',
  effort: 'aller',
};
