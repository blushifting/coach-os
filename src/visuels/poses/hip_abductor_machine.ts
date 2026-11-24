import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Abducteurs machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const hip_abductor_machine: PoseExercice = {
  id: 'hip_abductor_machine',
  camera: { tour: 10, hauteur: 30 },
  mainFermee: true,
  materiel: [
    { type: 'abdAdducteurs', pos: [0, 0, 0], tour: 0, variante: 'abduction', course: [0, 32] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 64, -10], bascule: -10 },
      cou: { flex: 6 },
      bras: { cible: { repere: 'monde', pos: [29, 56, -7], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [0, 9.5, 0], pole: [0, 1, 0.3], tour: 6, pointe: 0, repere: 'piedG' } },
    }),
    pose({
      bassin: { pos: [0, 64, -10], bascule: -10 },
      cou: { flex: 6 },
      bras: { cible: { repere: 'monde', pos: [29, 56, -7], axe: [0, 0, 1], pole: [1, 0, -0.3] } },
      jambe: { cible: { pos: [0, 9.5, 0], pole: [0, 1, 0.3], tour: 6, pointe: 0, repere: 'piedG' } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
