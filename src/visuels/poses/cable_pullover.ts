import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pullover à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_pullover: PoseExercice = {
  id: 'cable_pullover',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [
    {
      type: 'poulie',
      pos: [0, 0, 100],
      tour: 180,
      hauteur: 198,
      prise: { type: 'barre', longueur: 60 },
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 142.42, 80.8],
          axe: [1, 0, 0],
          pole: [-0.37, -0.92, 0.13],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 127.99, 80.62],
          axe: [1, 0, 0],
          pole: [-0.32, -0.94, -0.1],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 114.01, 77],
          axe: [1, 0, 0],
          pole: [-0.27, -0.9, -0.33],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 101.3, 70.17],
          axe: [1, 0, 0],
          pole: [-0.22, -0.81, -0.55],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 90.58, 60.51],
          axe: [1, 0, 0],
          pole: [-0.17, -0.66, -0.73],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 82.46, 48.57],
          axe: [1, 0, 0],
          pole: [-0.13, -0.47, -0.88],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 77.41, 35.05],
          axe: [1, 0, 0],
          pole: [-0.1, -0.24, -0.97],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: { repere: 'monde', pos: [24, 75.72, 20.71], axe: [1, 0, 0], pole: [-0.07, 0, -1] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 95, -6], bascule: 28 },
      lombaires: { flex: 4 },
      thorax: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        pronation: 70,
        cible: {
          repere: 'monde',
          pos: [24, 77.49, 6.39],
          axe: [1, 0, 0],
          pole: [-0.05, 0.24, -0.97],
        },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
