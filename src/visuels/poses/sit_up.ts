import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Sit-up au sol.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const sit_up: PoseExercice = {
  id: 'sit_up',
  camera: { tour: 70, hauteur: 14 },
  mainFermee: false,
  materiel: [],
  cles: [
    pose({
      bassin: { pos: [0, 11.66, 0], bascule: -90 },
      cou: { flex: 8 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [11, 8, 48], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 13.8, 0.43], bascule: -66 },
      lombaires: { flex: 26 },
      thorax: { flex: 22 },
      cou: { flex: 18 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [11, 8, 48], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 16.62, 2.65], bascule: -28 },
      lombaires: { flex: 10 },
      thorax: { flex: 6 },
      cou: { flex: 6 },
      bras: { cible: { repere: 'tete', pos: [8.6, 5, 2], pole: [1, -0.4, 0.7] } },
      jambe: { cible: { pos: [11, 8, 48], pole: [0, 1, 0.2], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
