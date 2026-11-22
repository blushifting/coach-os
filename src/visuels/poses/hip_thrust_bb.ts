import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Hip thrust barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const hip_thrust_bb: PoseExercice = {
  id: 'hip_thrust_bb',
  camera: { tour: 70, hauteur: 12 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [23, 0, -13.5], tour: 90, dossier: 0 },
    {
      type: 'barre',
      repere: 'monde',
      centre: [0, 37.54, 42.27],
      trajet: [
        [0, 0, 0],
        [0, 4.3, 2.11],
        [0, 8.23, 3.55],
        [0, 13.24, 4.3],
        [0, 18.38, 4.32],
        [0, 23.19, 3.64],
        [0, 29, 2.27],
      ],
    },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 24.38, 38.44], bascule: -50 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 29.17, 40.19], bascule: -57 },
      cou: { flex: 4.33 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 34.18, 41.33], bascule: -64 },
      cou: { flex: 8.67 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 39.31, 41.84], bascule: -71 },
      cou: { flex: 13 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 44.51, 41.7], bascule: -78 },
      cou: { flex: 17.33 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 49.68, 40.93], bascule: -85 },
      cou: { flex: 21.67 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 54.96, 39.54], bascule: -92 },
      cou: { flex: 26 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
