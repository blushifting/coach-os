import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crunch oblique.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const oblique_crunch: PoseExercice = {
  id: 'oblique_crunch',
  camera: { tour: 40, hauteur: 18 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.66, 0], bascule: -90 },
      bras: { cible: { repere: 'tete', pos: [8.5, 3, -6], pole: [1, 0.2, 0.2] } },
      jambe: { cible: { pos: [11, 8, 50], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 11.66, 0], bascule: -90 },
      lombaires: { flex: 10, tour: -13.5 },
      thorax: { flex: 26, tour: -16.5 },
      cou: { flex: 12 },
      bras: { cible: { repere: 'tete', pos: [8.5, 3, -6], pole: [1, 0.2, 0.2] } },
      jambe: { cible: { pos: [11, 8, 50], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
