import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Développé haltères assis.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const ohp_db_seated: PoseExercice = {
  id: 'ohp_db_seated',
  camera: { tour: 40, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 85 },
    { type: 'haltere', repere: 'poignetG', centre: [0, -4.8, 0] },
    { type: 'haltere', repere: 'poignetD', centre: [0, -4.8, 0] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.26, 134.22, 14.35],
          axe: [1, 0, 0],
          pole: [0.66, -0.73, 0.18],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [48.36, 139.76, 14.19],
          axe: [1, 0, 0],
          pole: [0.72, -0.67, 0.19],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [47.46, 145.22, 13.78],
          axe: [1, 0, 0],
          pole: [0.78, -0.6, 0.19],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [45.6, 150.4, 13.13],
          axe: [1, 0, 0],
          pole: [0.83, -0.52, 0.2],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [42.85, 155.14, 12.25],
          axe: [1, 0, 0],
          pole: [0.87, -0.44, 0.21],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [38.91, 159.26, 11.23],
          axe: [1, 0, 0],
          pole: [0.92, -0.35, 0.19],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [32.74, 162.53, 10.17],
          axe: [1, 0, 0],
          pole: [0.96, -0.24, 0.16],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: {
          repere: 'monde',
          pos: [26.04, 164.79, 9],
          axe: [1, 0, 0],
          pole: [0.99, -0.12, 0.1],
        },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 58.01, 13.99], bascule: -5 },
      lombaires: { flex: -3 },
      thorax: { flex: -2 },
      cou: { flex: -1.4 },
      bras: {
        pronation: -80,
        cible: { repere: 'monde', pos: [19, 165.95, 7.76], axe: [1, 0, 0], pole: [1, -0.2, 0] },
      },
      jambe: { cible: { pos: [24, 8, 60.43], pole: [0.25, 0.4, 1], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
