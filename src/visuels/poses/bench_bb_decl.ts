import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé décliné barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_bb_decl: PoseExercice = {
  id: 'bench_bb_decl',
  camera: { tour: -60, hauteur: 20 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: -20 },
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 100.47, -51.41],
      trajet: [[0, 0, 0], [0, -33.67, 12]],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.53 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.6 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.3, 0.1] } },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.53 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.6 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.8, 0.3] } },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
