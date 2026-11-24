import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Calf raise assis machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const calf_seated_machine: PoseExercice = {
  id: 'calf_seated_machine',
  camera: { tour: 250, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'molletsAssis', pos: [0, 0, 0], tour: 0, course: [0, 8] }],
  cles: [
    pose({
      bassin: { pos: [0, 62, -12] },
      cou: { flex: 10 },
      bras: { cible: { repere: 'genoux', pos: [16, 6, 0], axe: [1, 0, 0], pole: [1, 0, -1] } },
      jambe: { cible: { pos: [12, 8, 0], pole: [0, 0.3, 1], tour: 6, pointe: 0, repere: 'marche' } },
    }),
    pose({
      bassin: { pos: [0, 62, -12] },
      cou: { flex: 10 },
      bras: { cible: { repere: 'genoux', pos: [16, 6, 0], axe: [1, 0, 0], pole: [1, 0, -1] } },
      jambe: {
        cible: { pos: [12, 16, 4], pole: [0, 0.3, 1], tour: 6, pointe: 28, repere: 'marche' },
      },
    }),
  ],
  valide: true,
  effort: 'aller',
};
