import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl concentration.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const concentration_curl: PoseExercice = {
  id: 'concentration_curl',
  camera: { tour: 30, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [40, 0, -2], tour: 90, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.22, 26.98, 48.34],
          axe: [1, 0, 0.4],
          pole: [0.86, -0.17, -0.48],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.21, 29.73, 54.97],
          axe: [1, 0, 0.4],
          pole: [0.63, -0.28, -0.73],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.2, 34.04, 60.72],
          axe: [1, 0, 0.4],
          pole: [0.46, -0.39, -0.79],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.2, 39.63, 65.24],
          axe: [1, 0, 0.4],
          pole: [0.36, -0.5, -0.79],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.21, 46.15, 68.27],
          axe: [1, 0, 0.4],
          pole: [0.3, -0.6, -0.74],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.21, 53.21, 69.63],
          axe: [1, 0, 0.4],
          pole: [0.26, -0.69, -0.67],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.21, 60.38, 69.26],
          axe: [1, 0, 0.4],
          pole: [0.23, -0.77, -0.59],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.2, 67.26, 67.17],
          axe: [1, 0, 0.4],
          pole: [0.21, -0.84, -0.49],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 56.87, 0], bascule: 30 },
      lombaires: { flex: 18 },
      thorax: { flex: 14, tour: -6 },
      cou: { flex: -12 },
      brasG: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [12.2, 73.43, 63.47],
          axe: [1, 0, 0.4],
          pole: [0.19, -0.9, -0.38],
        },
      },
      brasD: { cible: { repere: 'monde', pos: [-23.78, 55.66, 33.85], pole: [-1, 0, -0.5] } },
      jambe: { cible: { pos: [33, 8, 42], pole: [0.35, 0.2, 1], tour: 22, pointe: 0 } },
    }),
  ],
  valide: true,
  cote: 'G',
  effort: 'aller',
};
