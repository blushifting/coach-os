import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Rear delt fly poulie (cross).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_rear_delt_fly: PoseExercice = {
  id: 'cable_rear_delt_fly',
  camera: { tour: 155, hauteur: 16 },
  mainFermee: true,
  materiel: [{ type: 'visAVis', pos: [0, 0, 60], tour: 0, ecart: 200, hauteur: 172, croise: true }],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [13.66, 143.45, 57.07], pole: [1, -0.5, 0.11] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [23.23, 143.45, 57.23], pole: [1, -0.5, -0.07] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [32.69, 143.45, 55.74], pole: [0.97, -0.5, -0.24] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [41.74, 143.45, 52.62], pole: [0.91, -0.5, -0.41] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [50.11, 143.45, 47.98], pole: [0.83, -0.5, -0.56] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [57.55, 143.45, 41.95], pole: [0.72, -0.5, -0.7] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [63.83, 143.45, 34.73], pole: [0.59, -0.5, -0.81] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: 80,
        cible: { repere: 'monde', pos: [68.77, 143.45, 26.52], pole: [0.44, -0.5, -0.9] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        clav: [0, -1.5],
        pronation: 80,
        cible: { repere: 'monde', pos: [72.2, 143.45, 17.58], pole: [0.28, -0.5, -0.96] },
      },
      jambe: { cible: { pos: [12, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
