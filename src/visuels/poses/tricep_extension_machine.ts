import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Extension triceps machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const tricep_extension_machine: PoseExercice = {
  id: 'tricep_extension_machine',
  camera: { tour: 60, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'curlMachine', pos: [0, 0, 0], tour: 0, variante: 'triceps', course: [80, -15] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 70, -22] },
      thorax: { flex: 16 },
      cou: { flex: -10 },
      bras: { cible: { repere: 'barre', pos: [12, 0, 0], axe: [0, 1, 0], pole: [0, 0, -1] } },
      jambe: { cible: { pos: [12, 8, 19], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 70, -22] },
      thorax: { flex: 16 },
      cou: { flex: -10 },
      bras: { cible: { repere: 'barre', pos: [12, 0, 0], axe: [0, 1, 0], pole: [0, 0, -1] } },
      jambe: { cible: { pos: [12, 8, 19], pole: [0, 0.3, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
