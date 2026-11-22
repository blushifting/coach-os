import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Rowing haltère un bras.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_row: PoseExercice = {
  id: 'db_row',
  camera: { tour: 75, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [29.18, 39.04, 2.42],
          axe: [0, 0, 1],
          pole: [0.39, 0.08, -0.92],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [30.64, 40.82, -4.03],
          axe: [0, 0, 1],
          pole: [0.29, 0.19, -0.94],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [31.94, 44.06, -9.93],
          axe: [0, 0, 1],
          pole: [0.25, 0.3, -0.92],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [32.99, 48.59, -14.97],
          axe: [0, 0, 1],
          pole: [0.23, 0.4, -0.89],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [33.76, 54.16, -18.88],
          axe: [0, 0, 1],
          pole: [0.21, 0.5, -0.84],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [34.19, 60.49, -21.47],
          axe: [0, 0, 1],
          pole: [0.19, 0.6, -0.78],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [34.27, 67.25, -22.59],
          axe: [0, 0, 1],
          pole: [0.17, 0.68, -0.71],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [33.99, 74.09, -22.19],
          axe: [0, 0, 1],
          pole: [0.15, 0.76, -0.63],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
    pose({
      bassin: { pos: [8, 93.07, -42], bascule: 82.46 },
      cou: { flex: -20 },
      brasG: {
        cible: {
          repere: 'monde',
          pos: [33.37, 80.64, -20.29],
          axe: [0, 0, 1],
          pole: [0.12, 0.83, -0.55],
        },
      },
      brasD: {
        cible: {
          repere: 'monde',
          pos: [-4, 47.5, 12.58],
          pole: [-0.3, 0, -1],
          plat: { normale: [0, -1, 0], doigts: [0, 0, 1] },
        },
      },
      jambeG: { cible: { pos: [25, 8, -40], pole: [0.3, 0.1, 1], tour: 10, pointe: 0 } },
      jambeD: { cible: { pos: [-2, 49, -84.5], pole: [0, -1, 0.4], tour: 0, pointe: 88 } },
    }),
  ],
  valide: true,
  cote: 'G',
};
