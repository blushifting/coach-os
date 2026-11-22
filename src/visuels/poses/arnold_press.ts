import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Arnold press.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const arnold_press: PoseExercice = {
  id: 'arnold_press',
  camera: { tour: 40, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 85 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 58.01, 13.98], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: 90,
        cible: { repere: 'monde', pos: [12, 115.45, 27.75], pole: [0.15, -1, 0.5] },
      },
      jambe: { cible: { pos: [24, 8, 60.42], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.98], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: 45,
        cible: { repere: 'monde', pos: [23, 128.45, 14.75], pole: [1, -0.6, 0.3] },
      },
      jambe: { cible: { pos: [24, 8, 60.42], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.98], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: { cible: { repere: 'monde', pos: [15, 157.45, 8.75], pole: [1, -0.2, 0] } },
      jambe: { cible: { pos: [24, 8, 60.42], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
