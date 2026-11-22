import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pompes lestées.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pushup_loaded: PoseExercice = {
  id: 'pushup_loaded',
  camera: { tour: 35, hauteur: 0 },
  mainFermee: false,
  materiel: [{ type: 'disque', repere: 'thorax', centre: [0, 17, -15.5], rayon: 16.5 }],
  cles: [
    pose({
      bassin: { pos: [0, 42.74, 2.83], bascule: 73 },
      cou: { flex: -18 },
      tete: { flex: -10 },
      bras: {
        pronation: -58,
        poignet: { flex: -90, dev: 2 },
        cible: {
          repere: 'monde',
          pos: [26, 3, 39.69],
          pole: [0.5, 0.35, -0.8],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambe: { cible: { pos: [11, 16.47, -83.09], pole: [0, -0.96, 0.29], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 36.17, 4.57], bascule: 77.33 },
      cou: { flex: -18 },
      tete: { flex: -10 },
      bras: {
        pronation: -60.5,
        poignet: { flex: -74, dev: -11 },
        cible: {
          repere: 'monde',
          pos: [26, 3, 39.69],
          pole: [0.5, 0.35, -0.8],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambe: { cible: { pos: [11, 16.47, -83.09], pole: [0, -0.98, 0.22], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 29.49, 5.81], bascule: 81.67 },
      cou: { flex: -18 },
      tete: { flex: -10 },
      bras: {
        pronation: -63,
        poignet: { flex: -67, dev: -16.5 },
        cible: {
          repere: 'monde',
          pos: [26, 3, 39.69],
          pole: [0.5, 0.35, -0.8],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambe: { cible: { pos: [11, 16.47, -83.09], pole: [0, -0.99, 0.14], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 22.73, 6.54], bascule: 86 },
      cou: { flex: -18 },
      tete: { flex: -10 },
      bras: {
        pronation: -65.5,
        poignet: { flex: -65.5, dev: -18.5 },
        cible: {
          repere: 'monde',
          pos: [26, 3, 39.69],
          pole: [0.5, 0.35, -0.8],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambe: { cible: { pos: [11, 16.47, -83.09], pole: [0, -1, 0.07], tour: 0, pointe: 70 } },
    }),
  ],
  valide: false,
};
