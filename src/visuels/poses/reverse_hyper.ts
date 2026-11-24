import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Reverse hyper.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const reverse_hyper: PoseExercice = {
  id: 'reverse_hyper',
  camera: { tour: 80, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'reverseHyper', pos: [0, 0, 0], tour: 0, course: [0, 60] }],
  cles: [
    pose({
      bassin: { pos: [0, 114, 2], bascule: 90 },
      cou: { flex: -20 },
      bras: { cible: { repere: 'monde', pos: [24, 84, 88], axe: [0, 1, 0], pole: [1, -0.3, 0] } },
      jambe: {
        cible: { pos: [10, 0, 6], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'chevilles' },
      },
    }),
    pose({
      bassin: { pos: [0, 114, 2], bascule: 90 },
      cou: { flex: -20 },
      bras: { cible: { repere: 'monde', pos: [24, 84, 88], axe: [0, 1, 0], pole: [1, -0.3, 0] } },
      jambe: {
        cible: { pos: [10, 0, 6], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'chevilles' },
      },
    }),
  ],
  valide: true,
  effort: 'aller',
};
