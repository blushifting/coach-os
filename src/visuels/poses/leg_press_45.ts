import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Presse à jambes.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const leg_press_45: PoseExercice = {
  id: 'leg_press_45',
  camera: { tour: 70, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'presseCuisses', pos: [0, 0, 0], tour: 0, course: [0, 34] }],
  cles: [
    pose({
      bassin: { pos: [0, 59.5, -8], bascule: -20 },
      cou: { flex: 8 },
      bras: { cible: { repere: 'monde', pos: [25, 54, 0], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [11, 8, -4], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 59.5, -8], bascule: -20 },
      cou: { flex: 8 },
      bras: { cible: { repere: 'monde', pos: [25, 54, 0], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [11, 8, -4], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
