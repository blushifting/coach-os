import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * French press EZ allongé.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const french_press_ez: PoseExercice = {
  id: 'french_press_ez',
  camera: { tour: 110, hauteur: 18 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    {
      type: 'barreEz',
      repere: 'monde',
      centre: [0, 110.96, -55.55],
      trajet: [
        [0, 0, 0],
        [0, -2.89, -6.34],
        [0, -7.14, -11.87],
        [0, -12.52, -16.31],
        [0, -18.76, -19.42],
        [0, -25.54, -21.05],
        [0, -32.51, -21.11],
        [0, -39.32, -19.6],
        [0, -45.62, -16.6],
      ],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.9, 0.06, 0.43] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.45, 0.31, 0.84] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.27, 0.45, 0.85] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.2, 0.56, 0.8] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.16, 0.66, 0.74] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.13, 0.74, 0.66] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.11, 0.82, 0.57] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.1, 0.88, 0.47] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: {
        pronation: 80,
        cible: { repere: 'barre', pos: [15, 0, 0], axe: [1, 0, 0], pole: [-0.09, 0.93, 0.36] },
      },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'retour',
};
