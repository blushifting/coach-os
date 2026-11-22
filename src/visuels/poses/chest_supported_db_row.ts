import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Rowing haltères torse appuyé.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const chest_supported_db_row: PoseExercice = {
  id: 'chest_supported_db_row',
  camera: { tour: 110, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 40 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-25.26, 48.14, -55.05],
          axe: [0, 0, 1],
          pole: [-0.89, 0.11, 0.44],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-28.94, 50.09, -50.08],
          axe: [0, 0, 1],
          pole: [-0.75, 0.21, 0.62],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-32.18, 53.32, -45.48],
          axe: [0, 0, 1],
          pole: [-0.68, 0.31, 0.66],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-34.83, 57.68, -41.47],
          axe: [0, 0, 1],
          pole: [-0.62, 0.41, 0.67],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-36.75, 62.96, -38.22],
          axe: [0, 0, 1],
          pole: [-0.57, 0.5, 0.65],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-37.86, 68.92, -35.91],
          axe: [0, 0, 1],
          pole: [-0.52, 0.59, 0.62],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-38.11, 75.28, -34.62],
          axe: [0, 0, 1],
          pole: [-0.47, 0.67, 0.57],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-37.48, 81.73, -34.43],
          axe: [0, 0, 1],
          pole: [-0.41, 0.75, 0.53],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
    pose({
      bassin: { pos: [0, 76.72, -20.44], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-36, 87.98, -35.33],
          axe: [0, 0, 1],
          pole: [-0.34, 0.81, 0.47],
        },
      },
      jambe: { cible: { pos: [-22, 15.02, -2.9], pole: [-0.4, 0.2, -1], tour: 175, pointe: 40 } },
    }),
  ],
  valide: true,
};
