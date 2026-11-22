import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Inverted row (rowing horizontal corps).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const inverted_row: PoseExercice = {
  id: 'inverted_row',
  camera: { tour: 70, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'barreTraction', pos: [0, 0, 0], tour: 0, hauteur: 95, largeur: 120 }],
  cles: [
    pose({
      bassin: { pos: [0, 28.79, 26.14], bascule: -76.16 },
      cou: { flex: 10 },
      bras: { cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0.4] } },
      jambe: { cible: { pos: [11, 7.3, 113.38], pole: [0, 0.97, 0.24], tour: 0, pointe: -76.16 } },
    }),
    pose({
      bassin: { pos: [0, 48.52, 33.54], bascule: -62.69 },
      cou: { flex: 10 },
      bras: { cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [0.5, -1, 0.4] } },
      jambe: { cible: { pos: [11, 7.3, 113.38], pole: [0, 0.89, 0.46], tour: 0, pointe: -62.69 } },
    }),
  ],
  valide: true,
};
