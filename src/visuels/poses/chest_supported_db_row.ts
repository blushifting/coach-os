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
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-28.26, 39.57, -41.26],
          axe: [0, 0, 1],
          pole: [-0.89, 0.11, 0.44],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-31.94, 41.52, -36.29],
          axe: [0, 0, 1],
          pole: [-0.75, 0.21, 0.62],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-35.18, 44.75, -31.69],
          axe: [0, 0, 1],
          pole: [-0.68, 0.31, 0.66],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-37.08, 48.36, -27.68],
          axe: [0, 0, 1],
          pole: [-0.62, 0.41, 0.67],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-38.1, 52.74, -24.43],
          axe: [0, 0, 1],
          pole: [-0.57, 0.5, 0.65],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-38.46, 57.95, -22.12],
          axe: [0, 0, 1],
          pole: [-0.52, 0.59, 0.62],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-38.11, 63.71, -20.83],
          axe: [0, 0, 1],
          pole: [-0.47, 0.67, 0.57],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-37.48, 70.16, -20.64],
          axe: [0, 0, 1],
          pole: [-0.41, 0.75, 0.53],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
    pose({
      bassin: { pos: [0, 65.15, -6.65], bascule: 50, tour: 180 },
      cou: { flex: -20 },
      tete: { flex: -10 },
      bras: {
        cible: {
          repere: 'monde',
          pos: [-36, 76.41, -21.54],
          axe: [0, 0, 1],
          pole: [-0.34, 0.81, 0.47],
        },
      },
      jambe: { hanche: { flex: 20, abd: 35, rot: 30 }, genou: 40 },
    }),
  ],
  valide: true,
};
