import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Spider curl (banc incliné face).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const spider_curl: PoseExercice = {
  id: 'spider_curl',
  camera: { tour: 110, hauteur: 10 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 45 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 59.49, -66.41],
          axe: [1, 0, 0],
          pole: [0.16, -0.1, 0.98],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 61.96, -73.57],
          axe: [1, 0, 0],
          pole: [0.07, -0.23, 0.97],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 66.11, -79.91],
          axe: [1, 0, 0],
          pole: [0.05, -0.35, 0.94],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 71.67, -85.04],
          axe: [1, 0, 0],
          pole: [0.03, -0.46, 0.89],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 78.33, -88.67],
          axe: [1, 0, 0],
          pole: [0.03, -0.57, 0.82],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 85.66, -90.55],
          axe: [1, 0, 0],
          pole: [0.02, -0.67, 0.74],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 93.24, -90.59],
          axe: [1, 0, 0],
          pole: [0.03, -0.76, 0.65],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 100.59, -88.79],
          axe: [1, 0, 0],
          pole: [0.02, -0.83, 0.55],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 84.95, -25.36], bascule: 45, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        pronation: -90,
        cible: {
          repere: 'monde',
          pos: [-18.4, 107.28, -85.24],
          axe: [1, 0, 0],
          pole: [0.02, -0.9, 0.44],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -8.12], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
  ],
  valide: true,
};
