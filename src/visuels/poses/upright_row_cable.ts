import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Tirage menton poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const upright_row_cable: PoseExercice = {
  id: 'upright_row_cable',
  camera: { tour: 140, hauteur: 12 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [0, 0, 37],
      tour: 180,
      hauteur: 15,
      prise: { type: 'barre', longueur: 50 },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [22, -34, 17], pole: [1, 0, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        clav: [2, 0.2],
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [22, -10, 17], pole: [1, 0.3, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        clav: [5, 0.5],
        pronation: 45,
        cible: { repere: 'thorax', axe: [1, 0, 0], pos: [22, 24, 24], pole: [1, 0.3, -0.3] },
      },
      jambe: { cible: { pos: [11, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
