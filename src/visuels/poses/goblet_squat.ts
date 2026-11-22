import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Goblet squat.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const goblet_squat: PoseExercice = {
  id: 'goblet_squat',
  camera: { tour: 40, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'haltere', repere: 'thorax', centre: [0, 5, 19.5], axe: [0, 1, 0] }],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 0], bascule: 2 },
      bras: { pronation: 20, cible: { repere: 'thorax', pos: [6, 7, 18], pole: [0.4, -1, 0.2] } },
      jambe: { cible: { pos: [18, 8, 0], pole: [0.42, 0, 0.91], tour: 25, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 48, -12], bascule: 16 },
      lombaires: { flex: 2 },
      cou: { flex: -6 },
      bras: { pronation: 20, cible: { repere: 'thorax', pos: [6, 7, 18], pole: [0.4, -1, 0.2] } },
      jambe: { cible: { pos: [18, 8, 0], pole: [0.42, 0, 0.91], tour: 25, pointe: 0 } },
    }),
  ],
  valide: true,
};
