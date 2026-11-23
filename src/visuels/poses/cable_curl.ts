import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl poulie basse.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_curl: PoseExercice = {
  id: 'cable_curl',
  camera: { tour: 55, hauteur: 10 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [0, 0, 75],
      tour: 180,
      hauteur: 15,
      prise: { type: 'barre', longueur: 60 },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 86.6, 10.36],
          axe: [1, 0, 0],
          pole: [0.86, -0.06, -0.5],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 89.14, 17.72],
          axe: [1, 0, 0],
          pole: [0.56, -0.21, -0.8],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 93.43, 24.37],
          axe: [1, 0, 0],
          pole: [0.39, -0.35, -0.85],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 99.19, 29.89],
          axe: [1, 0, 0],
          pole: [0.3, -0.48, -0.83],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 106.05, 33.97],
          axe: [1, 0, 0],
          pole: [0.25, -0.6, -0.77],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 113.57, 36.38],
          axe: [1, 0, 0],
          pole: [0.21, -0.7, -0.68],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 121.28, 37],
          axe: [1, 0, 0],
          pole: [0.19, -0.79, -0.58],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 128.69, 35.86],
          axe: [1, 0, 0],
          pole: [0.17, -0.87, -0.46],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.4, 0], bascule: 2 },
      thorax: { flex: 2 },
      bras: {
        pronation: -85,
        cible: {
          repere: 'monde',
          pos: [20, 135.32, 33.09],
          axe: [1, 0, 0],
          pole: [0.16, -0.93, -0.34],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
