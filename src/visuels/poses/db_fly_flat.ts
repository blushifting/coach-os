import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Écarté aux haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const db_fly_flat: PoseExercice = {
  id: 'db_fly_flat',
  camera: { tour: 150, hauteur: 26 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [16.36, 112.36, -32.85],
          axe: [0, 0, 1],
          pole: [0.99, 0.02, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [28.12, 111.4, -32.85],
          axe: [0, 0, 1],
          pole: [0.97, -0.18, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [39.45, 108.13, -32.85],
          axe: [0, 0, 1],
          pole: [0.92, -0.37, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [49.91, 102.7, -32.85],
          axe: [0, 0, 1],
          pole: [0.83, -0.54, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [59.1, 95.31, -32.85],
          axe: [0, 0, 1],
          pole: [0.71, -0.69, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [66.66, 86.25, -32.85],
          axe: [0, 0, 1],
          pole: [0.55, -0.82, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [72.27, 75.88, -32.85],
          axe: [0, 0, 1],
          pole: [0.38, -0.91, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [75.73, 64.61, -32.85],
          axe: [0, 0, 1],
          pole: [0.2, -0.97, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [76.9, 52.87, -32.85],
          axe: [0, 0, 1],
          pole: [0, -0.99, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
