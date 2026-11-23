import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl à la barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bb_curl: PoseExercice = {
  id: 'bb_curl',
  camera: { tour: 35, hauteur: 10 },
  mainFermee: true,
  materiel: [
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 89, 12],
      trajet: [[0, 0, 0], [0, 26, 16], [0, 44, 10]],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -90,
        cible: { repere: 'barre', pos: [19, 0, 0], axe: [1, 0, 0], pole: [0.15, -0.4, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      bras: {
        pronation: -90,
        cible: { repere: 'barre', pos: [19, 0, 0], axe: [1, 0, 0], pole: [0.15, -0.4, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
