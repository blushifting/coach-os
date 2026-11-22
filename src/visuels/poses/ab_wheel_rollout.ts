import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Roue abdominale.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const ab_wheel_rollout: PoseExercice = {
  id: 'ab_wheel_rollout',
  camera: { tour: 75, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'roueAbdo', pos: [0, 0, 0], tour: 0, course: [50.52, 69.07, 87.8, 104.21, 117.14] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 51.89, -9.04], bascule: 57.92 },
      lombaires: { flex: 16 },
      cou: { flex: -10 },
      bras: {
        cible: { repere: 'poignee', pos: [10, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.6, -0.6] },
      },
      jambe: { cible: { pos: [11, 16.47, -61.09], pole: [0, -26.45, 16.35], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 48.72, 1.02], bascule: 59.94 },
      lombaires: { flex: 13 },
      cou: { flex: -10 },
      bras: {
        cible: { repere: 'poignee', pos: [10, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.6, -0.6] },
      },
      jambe: { cible: { pos: [11, 16.47, -61.09], pole: [0, -24.94, 11.37], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 43.26, 10.06], bascule: 61.96 },
      lombaires: { flex: 10 },
      cou: { flex: -10 },
      bras: {
        cible: { repere: 'poignee', pos: [10, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.6, -0.6] },
      },
      jambe: { cible: { pos: [11, 16.47, -61.09], pole: [0, -22.29, 6.89], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 35.82, 17.59], bascule: 63.98 },
      lombaires: { flex: 7 },
      cou: { flex: -10 },
      bras: {
        cible: { repere: 'poignee', pos: [10, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.6, -0.6] },
      },
      jambe: { cible: { pos: [11, 16.47, -61.09], pole: [0, -18.65, 3.17], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 26.82, 23.16], bascule: 66 },
      lombaires: { flex: 4 },
      cou: { flex: -10 },
      bras: {
        cible: { repere: 'poignee', pos: [10, 0, 0], axe: [1, 0, 0], pole: [0.5, -0.6, -0.6] },
      },
      jambe: { cible: { pos: [11, 16.47, -61.09], pole: [0, -14.22, 0.42], tour: 0, pointe: 70 } },
    }),
  ],
  valide: true,
};
