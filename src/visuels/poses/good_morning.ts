import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Good morning barre.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const good_morning: PoseExercice = {
  id: 'good_morning',
  camera: { tour: 150, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'barre', repere: 'thorax', centre: [0, 23, -10.4] }],
  cles: [
    pose({
      bassin: { pos: [0, 97, 0], bascule: 2 },
      bras: { cible: { repere: 'thorax', pos: [40, 19, -9.5], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 87.5, -15.5], bascule: 70 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      cou: { flex: -28 },
      tete: { flex: -10 },
      bras: { cible: { repere: 'thorax', pos: [40, 19, -9.5], pole: [0.35, -1, -0.55] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
