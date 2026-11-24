import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Mollets debout.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const calf_standing_machine: PoseExercice = {
  id: 'calf_standing_machine',
  camera: { tour: 130, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'molletsDebout', pos: [0, 0, 0], tour: 0, course: [0, 6.02] }],
  cles: [
    pose({
      bassin: { pos: [0, 113.8, -4] },
      bras: { cible: { repere: 'epaulieres', pos: [20, 11, 18], axe: [0, 1, 0], pole: [1, -1, 0] } },
      jambe: { cible: { pos: [12, 8, -4], pole: [0, 0, 1], tour: 0, pointe: 0, repere: 'marche' } },
    }),
    pose({
      bassin: { pos: [0, 119.82, 1] },
      bras: { cible: { repere: 'epaulieres', pos: [20, 11, 18], axe: [0, 1, 0], pole: [1, -1, 0] } },
      jambe: {
        cible: { pos: [12, 14.02, 1], pole: [0, 0, 1], tour: 0, pointe: 32, repere: 'marche' },
      },
    }),
  ],
  valide: true,
  effort: 'aller',
};
