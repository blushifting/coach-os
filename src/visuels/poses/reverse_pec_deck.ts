import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pec deck inversé.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const reverse_pec_deck: PoseExercice = {
  id: 'reverse_pec_deck',
  camera: { tour: 150, hauteur: 18 },
  mainFermee: true,
  materiel: [{ type: 'pecDeck', pos: [0, 0, 0], tour: 180, variante: 'inverse', course: [14, 104] }],
  cles: [
    pose({
      bassin: { pos: [0, 67.6, 1] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeD', pos: [0, 0, 0], axe: [0, 1, 0], pole: [-1, 0, 0] } },
      jambe: { cible: { pos: [22, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 67.6, 1] },
      cou: { flex: -4 },
      bras: { cible: { repere: 'poigneeD', pos: [0, 0, 0], axe: [0, 1, 0], pole: [-1, 0, 0] } },
      jambe: { cible: { pos: [22, 8, 40], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
