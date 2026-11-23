import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pec deck (butterfly machine).
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pec_deck: PoseExercice = {
  id: 'pec_deck',
  camera: { tour: 35, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'pecDeck', pos: [0, 0, 0], tour: 0, variante: 'butterfly', course: [85, 2] }],
  cles: [
    pose({
      bassin: { pos: [0, 67.9, -1], bascule: -4 },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.2, -1, -0.4] } },
      jambe: { cible: { pos: [12, 8, 42], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 67.9, -1], bascule: -4 },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeG', pos: [0, 0, 0], axe: [0, 1, 0], pole: [0.2, -1, -0.4] } },
      jambe: { cible: { pos: [12, 8, 42], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
