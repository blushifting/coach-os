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
        [0, 3.89, 1.91],
        [0, 7.48, 3.28],
        [0, 11.81, 4.09],
        [0, 16.42, 4.31],
        [0, 20.9, 3.96],
        [0, 25.68, 3.05],
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
      bassin: { pos: [0, 28.71, 40.02], bascule: -56.33 },
      cou: { flex: 3.92 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 33.23, 41.11], bascule: -62.67 },
      cou: { flex: 7.84 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 37.84, 41.69], bascule: -69 },
      cou: { flex: 11.76 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 42.53, 41.75], bascule: -75.33 },
      cou: { flex: 15.68 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 47.22, 41.3], bascule: -81.67 },
      cou: { flex: 19.6 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 51.94, 40.33], bascule: -88 },
      cou: { flex: 23.53 },
      bras: { cible: { repere: 'barre', pos: [24, 0, 0], axe: [1, 0, 0], pole: [1, 0.3, 0] } },
      jambe: { cible: { pos: [12, 8, 91.54], pole: [0.15, 1, 0.4], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
