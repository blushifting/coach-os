import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Élévations frontales poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_front_raise: PoseExercice = {
  id: 'cable_front_raise',
  camera: { tour: 62, hauteur: 14 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [0, 0, -34],
      tour: 0,
      hauteur: 15,
      prise: { type: 'barre', longueur: 70 },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 2 },
      lombaires: { flex: 1 },
      thorax: { flex: 2 },
      bras: {
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 87.93, 18.92],
          axe: [1, 0, 0],
          pole: [0.25, -0.24, -0.94],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 1.75 },
      lombaires: { flex: 0.75 },
      thorax: { flex: 1.75 },
      bras: {
        clav: [0.13, 0.06],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 92.28, 29.57],
          axe: [1, 0, 0],
          pole: [0.25, -0.42, -0.87],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 1.5 },
      lombaires: { flex: 0.5 },
      thorax: { flex: 1.5 },
      bras: {
        clav: [0.25, 0.13],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 98.7, 39.19],
          axe: [1, 0, 0],
          pole: [0.24, -0.58, -0.78],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 1.25 },
      lombaires: { flex: 0.25 },
      thorax: { flex: 1.25 },
      bras: {
        clav: [0.38, 0.19],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 106.96, 47.38],
          axe: [1, 0, 0],
          pole: [0.23, -0.73, -0.65],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 1 },
      thorax: { flex: 1 },
      bras: {
        clav: [0.5, 0.25],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 116.74, 53.82],
          axe: [1, 0, 0],
          pole: [0.2, -0.84, -0.5],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 0.75 },
      lombaires: { flex: -0.25 },
      thorax: { flex: 0.75 },
      bras: {
        clav: [0.63, 0.31],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 127.67, 58.25],
          axe: [1, 0, 0],
          pole: [0.17, -0.93, -0.32],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 0.5 },
      lombaires: { flex: -0.5 },
      thorax: { flex: 0.5 },
      bras: {
        clav: [0.75, 0.38],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 139.34, 60.47],
          axe: [1, 0, 0],
          pole: [0.13, -0.98, -0.13],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0], bascule: 0.25 },
      lombaires: { flex: -0.75 },
      thorax: { flex: 0.25 },
      bras: {
        clav: [0.88, 0.44],
        pronation: 90,
        cible: { repere: 'monde', pos: [23, 151.31, 60.39], axe: [1, 0, 0], pole: [0.07, -1, 0.07] },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, 0] },
      lombaires: { flex: -1 },
      bras: {
        clav: [1, 0.5],
        pronation: 90,
        cible: {
          repere: 'monde',
          pos: [23, 163.11, 57.98],
          axe: [1, 0, 0],
          pole: [0.01, -0.97, 0.26],
        },
      },
      jambe: { cible: { pos: [15, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
