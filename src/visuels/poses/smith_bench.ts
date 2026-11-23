import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Bench press Smith machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const smith_bench: PoseExercice = {
  id: 'smith_bench',
  camera: { tour: 45, hauteur: 28 },
  mainFermee: true,
  materiel: [
    { type: 'banc', pos: [0, 0, 0], tour: 0, dossier: 0 },
    { type: 'smith', pos: [0, 0, -27], tour: 0, course: [106, 68] },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.3, 0.1] } },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 55.56, 10], bascule: -86.17 },
      lombaires: { flex: -6 },
      thorax: { flex: -4 },
      cou: { flex: 9.6 },
      bras: { cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.8, 0.25] } },
      jambe: { cible: { pos: [27, 8, 58.99], pole: [0.25, 1, 0.3], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
