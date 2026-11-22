import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé incliné haltères 30°.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_db_incl30: PoseExercice = {
  id: 'bench_db_incl30',
  camera: { tour: 125, hauteur: 22 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 30 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [17, 136.38, -41.11],
          axe: [1, 0, 0],
          pole: [0.99, 0.04, 0.1],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [24.41, 134.3, -39.77],
          axe: [1, 0, 0],
          pole: [0.99, -0.09, 0.13],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [32.57, 131.14, -38.4],
          axe: [1, 0, 0],
          pole: [0.96, -0.25, 0.14],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [40.21, 126.57, -37.15],
          axe: [1, 0, 0],
          pole: [0.9, -0.4, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [45.93, 120.67, -36.2],
          axe: [1, 0, 0],
          pole: [0.83, -0.54, 0.15],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.51, 113.99, -35.68],
          axe: [1, 0, 0],
          pole: [0.76, -0.64, 0.14],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.8, 107.04, -35.53],
          axe: [1, 0, 0],
          pole: [0.68, -0.72, 0.13],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.81, 100.17, -35.68],
          axe: [1, 0, 0],
          pole: [0.58, -0.81, 0.12],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.22, 3.5], bascule: -60 },
      lombaires: { flex: -5 },
      thorax: { flex: -3 },
      cou: { flex: 12.2 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.8, 93.52, -36.12],
          axe: [1, 0, 0],
          pole: [0.44, -0.89, 0.11],
        },
      },
      jambe: { cible: { pos: [27, 8, 57.83], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
