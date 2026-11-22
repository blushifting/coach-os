import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Squat à la barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const squat_bb_high: PoseExercice = {
  id: 'squat_bb_high',
  camera: { tour: 48, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'thorax', centre: [0, 23, -10.4] }],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 0], bascule: 3 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      bras: { cible: { repere: 'thorax', pos: [40, 19, -9.5], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 51, -19], bascule: 30 },
      lombaires: { flex: 6 },
      thorax: { flex: 6 },
      cou: { flex: -14 },
      tete: { flex: -14 },
      bras: { cible: { repere: 'thorax', pos: [40, 19, -9.5], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.37, 0, 0.93], tour: 22, pointe: 0 } },
    }),
  ],
  valide: true,
};
