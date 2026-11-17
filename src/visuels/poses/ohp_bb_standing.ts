import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé militaire à la barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const ohp_bb_standing: PoseExercice = {
  id: 'ohp_bb_standing',
  camera: { tour: 55, hauteur: 10 },
  mainFermee: true,
  materiel: [
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 139, 13],
      trajet: [[0, 0, 0], [0, 30, 4], [0, 63, -11]],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.6, 0], bascule: -2 },
      thorax: { flex: -3 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [0.3, -1, 0.5] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.6, 0], bascule: -3 },
      thorax: { flex: -4 },
      cou: { flex: -8 },
      tete: { flex: -6 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [0.8, -0.6, 0.1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.6, 0], bascule: -1 },
      cou: { flex: 4 },
      bras: {
        clav: [2, 0],
        pronation: 90,
        cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0, 0] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
