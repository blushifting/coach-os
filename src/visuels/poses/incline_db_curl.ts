import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Curl incliné haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const incline_db_curl: PoseExercice = {
  id: 'incline_db_curl',
  camera: { tour: 60, hauteur: 10 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 60 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [25.79, 40.09, -13.6],
          axe: [1, 0, 0],
          pole: [0.47, -0.04, -0.88],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [27.45, 42.67, -6.47],
          axe: [1, 0, 0],
          pole: [0.1, -0.21, -0.97],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [28.91, 47.01, -0.2],
          axe: [1, 0, 0],
          pole: [-0.01, -0.35, -0.94],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [30.08, 52.82, 4.8],
          axe: [1, 0, 0],
          pole: [-0.06, -0.47, -0.88],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [30.88, 59.72, 8.23],
          axe: [1, 0, 0],
          pole: [-0.08, -0.59, -0.81],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [31.27, 67.27, 9.88],
          axe: [1, 0, 0],
          pole: [-0.08, -0.69, -0.72],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [31.21, 75, 9.64],
          axe: [1, 0, 0],
          pole: [-0.06, -0.78, -0.63],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [30.73, 82.44, 7.56],
          axe: [1, 0, 0],
          pole: [-0.05, -0.85, -0.52],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.95, 7.19], bascule: -30 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 1.5 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [29.83, 89.12, 3.73],
          axe: [1, 0, 0],
          pole: [-0.02, -0.91, -0.4],
        },
      },
      jambe: { cible: { pos: [24, 8, 55.69], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
