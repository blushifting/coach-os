import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Shrug à la Smith.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const machine_shrug: PoseExercice = {
  id: 'machine_shrug',
  camera: { tour: 28, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'smith', pos: [0, 0, 12.5], tour: 0, course: [88.5, 95.5] }],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      thorax: { flex: 3 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [23, 0, 0], axe: [1, 0, 0], pole: [0.3, 0, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      thorax: { flex: 3 },
      bras: {
        clav: [7, -0.5],
        pronation: 90,
        cible: { repere: 'barre', pos: [23, 0, 0], axe: [1, 0, 0], pole: [0.3, 0, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
