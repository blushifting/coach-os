import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Leg curl assis.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const leg_curl_seated: PoseExercice = {
  id: 'leg_curl_seated',
  camera: { tour: 60, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'legCurlAssis', pos: [0, 0, 0], tour: 0, course: [4, 95] }],
  cles: [
    pose({
      bassin: { pos: [0, 65.92, -23.37], bascule: -10 },
      lombaires: { flex: -5.54 },
      thorax: { flex: -5.54 },
      cou: { flex: 5.54 },
      bras: { cible: { repere: 'monde', pos: [25, 62, -6], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [10, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
    }),
    pose({
      bassin: { pos: [0, 65.92, -23.37], bascule: -10 },
      lombaires: { flex: -5.54 },
      thorax: { flex: -5.54 },
      cou: { flex: 5.54 },
      bras: { cible: { repere: 'monde', pos: [25, 62, -6], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [10, 0, 9], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'rouleau' } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
