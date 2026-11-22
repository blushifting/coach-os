import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé couché prise serrée.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_bb_close: PoseExercice = {
  id: 'bench_bb_close',
  camera: { tour: 135, hauteur: 28 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 106.87, -36.85],
      trajet: [[0, 0, 0], [0, -38.31, 14]],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: { cible: { repere: 'barre', pos: [21, 0, 0], axe: [1, 0, 0], pole: [0.6, -0.4, 0.3] } },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: { cible: { repere: 'barre', pos: [21, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.8, 0.6] } },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
