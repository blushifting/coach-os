import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Front squat.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const front_squat: PoseExercice = {
  id: 'front_squat',
  camera: { tour: 30, hauteur: 10 },
  mainFermee: false,
  materiel: [{ type: 'barre', repere: 'thorax', centre: [0, 30.8, 6.5] }],
  cles: [
    pose({
      bassin: { pos: [0, 96.5, 0], bascule: 2 },
      bras: {
        pronation: -75,
        poignet: { flex: -35, dev: -20 },
        cible: { repere: 'thorax', pos: [21.5, 28, 8], pole: [0.25, 0, 1] },
      },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.34, 0, 0.94], tour: 20, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 52, -14], bascule: 18 },
      lombaires: { flex: 2 },
      cou: { flex: -6 },
      bras: {
        pronation: -75,
        poignet: { flex: -35, dev: -20 },
        cible: { repere: 'thorax', pos: [21.5, 28, 8], pole: [0.25, 0, 1] },
      },
      jambe: { cible: { pos: [16, 8, 0], pole: [0.34, 0, 0.94], tour: 20, pointe: 0 } },
    }),
  ],
  valide: true,
};
