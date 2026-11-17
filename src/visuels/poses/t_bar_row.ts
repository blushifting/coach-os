import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * T-bar row (landmine).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const t_bar_row: PoseExercice = {
  id: 't_bar_row',
  camera: { tour: 62, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'landmine', pos: [0, 0, -97.7], tour: 0, course: [23.3, 29.8] }],
  cles: [
    pose({
      bassin: { pos: [0, 86.6, -19.8], bascule: 58 },
      lombaires: { flex: 7 },
      thorax: { flex: 8 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      bras: { cible: { repere: 'poignee', pos: [6, 0, 0], axe: [0, 0, 1], pole: [0.3, 0, -1] } },
      jambe: { cible: { pos: [20, 8, 0], pole: [0.24, 0, 0.97], tour: 14, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 86.6, -19.8], bascule: 58 },
      lombaires: { flex: 7 },
      thorax: { flex: 8 },
      cou: { flex: -25 },
      tete: { flex: -10 },
      bras: { cible: { repere: 'poignee', pos: [6, 0, 0], axe: [0, 0, 1], pole: [0.25, 0.6, -1] } },
      jambe: { cible: { pos: [20, 8, 0], pole: [0.24, 0, 0.97], tour: 14, pointe: 0 } },
    }),
  ],
  valide: true,
};
