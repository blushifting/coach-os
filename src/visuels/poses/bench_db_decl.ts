import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé décliné haltères.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const bench_db_decl: PoseExercice = {
  id: 'bench_db_decl',
  camera: { tour: -60, hauteur: 20 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: -20 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [17, 104.49, -51.42],
          axe: [1, 0, 0],
          pole: [0.99, 0.04, 0.11],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [23.12, 102.87, -49.36],
          axe: [1, 0, 0],
          pole: [0.98, -0.08, 0.18],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [30.25, 100.57, -47.45],
          axe: [1, 0, 0],
          pole: [0.95, -0.22, 0.24],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [37.24, 97.16, -45.76],
          axe: [1, 0, 0],
          pole: [0.89, -0.36, 0.28],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [42.82, 92.63, -44.37],
          axe: [1, 0, 0],
          pole: [0.83, -0.48, 0.3],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [45.81, 87.34, -43.34],
          axe: [1, 0, 0],
          pole: [0.77, -0.57, 0.29],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [47.08, 81.66, -42.69],
          axe: [1, 0, 0],
          pole: [0.71, -0.65, 0.28],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [47.29, 75.81, -42.46],
          axe: [1, 0, 0],
          pole: [0.65, -0.72, 0.26],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 64.83, -8], bascule: -108.5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: 5.5 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [47.29, 70.01, -42.64],
          axe: [1, 0, 0],
          pole: [0.57, -0.79, 0.24],
        },
      },
      jambe: { cible: { pos: [10, 29.64, 45.36], pole: [0, 1, 0.5], tour: 0, pointe: 0 } },
    }),
  ],
  valide: true,
};
