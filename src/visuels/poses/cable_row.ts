import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Tirage horizontal à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_row: PoseExercice = {
  id: 'cable_row',
  camera: { tour: 70, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'tirageHorizontalPoulie', pos: [0, 0, 0], tour: 0, prise: { type: 'triangle' } },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55, -20], bascule: 14 },
      lombaires: { flex: 4 },
      bras: { cible: { repere: 'monde', pos: [6, 78, 36], axe: [0, 1, 0], pole: [0.3, -1, 0] } },
      jambe: { cible: { repere: 'plateau', pos: [10, 8, 0], pole: [0, 0, 1], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55, -20], bascule: -4 },
      cou: { flex: 2 },
      bras: {
        clav: [0, -1.5],
        cible: { repere: 'monde', pos: [6, 82, -4], axe: [0, 1, 0], pole: [0.3, -0.4, -1] },
      },
      jambe: { cible: { repere: 'plateau', pos: [10, 8, 0], pole: [0, 0, 1], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
