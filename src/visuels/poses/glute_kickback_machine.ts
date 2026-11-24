import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Kickback fessiers machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const glute_kickback_machine: PoseExercice = {
  id: 'glute_kickback_machine',
  camera: { tour: 110, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'kickbackMachine', pos: [0, 0, 0], tour: 0, course: [0, 70] }],
  cles: [
    pose({
      bassin: { pos: [0, 96.1, -1.13], bascule: 35 },
      cou: { flex: -20 },
      bras: {
        cible: { repere: 'monde', pos: [24, 106, 58], axe: [0, 1, 0], pole: [1, -0.6, -0.4] },
      },
      jambeG: { cible: { pos: [0, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
      jambeD: { cible: { pos: [-12, 14, 4], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 96.1, -1.13], bascule: 35 },
      cou: { flex: -20 },
      bras: {
        cible: { repere: 'monde', pos: [24, 106, 58], axe: [0, 1, 0], pole: [1, -0.6, -0.4] },
      },
      jambeG: { cible: { pos: [0, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
      jambeD: { cible: { pos: [-12, 14, 4], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
  cote: 'G',
};
