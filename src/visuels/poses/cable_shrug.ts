import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Shrug poulie basse.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_shrug: PoseExercice = {
  id: 'cable_shrug',
  camera: { tour: 58, hauteur: 12 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [0, 0, 48],
      tour: 180,
      hauteur: 15,
      prise: { type: 'barre', longueur: 60 },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      thorax: { flex: 3 },
      bras: {
        pronation: 90,
        cible: { repere: 'monde', pos: [23, 88.5, 12.5], axe: [1, 0, 0], pole: [0.3, 0, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 3 },
      thorax: { flex: 3 },
      bras: {
        clav: [7, -0.5],
        pronation: 90,
        cible: { repere: 'monde', pos: [23, 95.5, 12.5], axe: [1, 0, 0], pole: [0.3, 0, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
