import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Tirage menton haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const upright_row_db: PoseExercice = {
  id: 'upright_row_db',
  camera: { tour: 25, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [16, -37, 18], pole: [1, 0, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        clav: [1.5, 0.2],
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [18, -16, 19], pole: [1, 0.4, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        clav: [4.5, 0.5],
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [20, 4, 15], pole: [1, 0.9, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
