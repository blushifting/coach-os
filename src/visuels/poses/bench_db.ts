import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé couché haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_db: PoseExercice = {
  id: 'bench_db',
  camera: { tour: 135, hauteur: 28 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.16 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [17, 110.88, -37.85],
          axe: [1, 0, 0],
          pole: [0.99, 0.04, 0.11],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [23.79, 109.02, -36.07],
          axe: [1, 0, 0],
          pole: [0.98, -0.09, 0.16],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [31.46, 106.3, -34.35],
          axe: [1, 0, 0],
          pole: [0.95, -0.23, 0.19],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [38.82, 102.31, -32.83],
          axe: [1, 0, 0],
          pole: [0.9, -0.38, 0.22],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [44.51, 97.08, -31.63],
          axe: [1, 0, 0],
          pole: [0.83, -0.51, 0.23],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [47.35, 91.07, -30.85],
          axe: [1, 0, 0],
          pole: [0.77, -0.61, 0.22],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.19, 84.71, -30.47],
          axe: [1, 0, 0],
          pole: [0.7, -0.69, 0.2],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.19, 78.3, -30.48],
          axe: [1, 0, 0],
          pole: [0.62, -0.76, 0.19],
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
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.2, 72.05, -30.87],
          axe: [1, 0, 0],
          pole: [0.51, -0.84, 0.17],
        },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
