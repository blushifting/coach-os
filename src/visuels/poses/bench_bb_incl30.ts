import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé incliné à la barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_bb_incl30: PoseExercice = {
  id: 'bench_bb_incl30',
  camera: { tour: 125, hauteur: 22 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 30 },
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 132.38, -41.11],
      trajet: [[0, 0, 0], [0, -42.93, 5]],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.3, 0.1] } },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.8, 0.2] } },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
