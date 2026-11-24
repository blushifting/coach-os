import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Calf raise smith machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const calf_smith: PoseExercice = {
  id: 'calf_smith',
  camera: { tour: 130, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'smith', pos: [0, 0, -2], tour: 0, course: [148.73, 154.93] }],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 6.61], bascule: 2 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.1, 0, 0.99], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 103.6, 6.61], bascule: 2 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [13.7, 14.8, 6.2], pole: [0.1, 0, 0.99], tour: 6, pointe: 38 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
