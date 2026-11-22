import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pullover haltère.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_pullover: PoseExercice = {
  id: 'db_pullover',
  camera: { tour: 110, hauteur: 18 },
  mainFermee: false,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [3.9, -6, 8], axe: [-1, 0, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -70,
        cible: {
          repere: 'monde',
          pos: [8, 95.38, -50.24],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -56,
        cible: {
          repere: 'monde',
          pos: [8, 92.88, -57.18],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -44,
        cible: {
          repere: 'monde',
          pos: [8, 89.25, -63.61],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -32,
        cible: {
          repere: 'monde',
          pos: [8, 84.6, -69.35],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -22,
        cible: {
          repere: 'monde',
          pos: [8, 79.05, -74.22],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -10,
        cible: {
          repere: 'monde',
          pos: [8, 72.77, -78.1],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -2,
        cible: {
          repere: 'monde',
          pos: [8, 65.93, -80.87],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: 8,
        cible: {
          repere: 'monde',
          pos: [8, 58.72, -82.46],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: 16,
        cible: {
          repere: 'monde',
          pos: [8, 51.34, -82.82],
          pole: [1, -0.3, 0],
          plat: { normale: [0, 1, 0], doigts: [0, 0, -1] },
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
