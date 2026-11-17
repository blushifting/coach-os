import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Rowing barre buste penché.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bb_row: PoseExercice = {
  id: 'bb_row',
  camera: { tour: 38, hauteur: 16 },
  mainFermee: true,
  materiel: [
    { type: 'barre', repere: 'monde', centre: [0, 64, 22], trajet: [[0, 0, 0], [0, 36, -3]] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 91.2, -14.2], bascule: 44 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -18 },
      tete: { flex: -8 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [0.5, 0.2, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 91.2, -14.2], bascule: 44 },
      lombaires: { flex: 3 },
      thorax: { flex: 3 },
      cou: { flex: -18 },
      tete: { flex: -8 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [0.35, 0.6, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.14, 0, 0.99], tour: 8, pointe: 0 } },
    }),
  ],
  valide: true,
};
