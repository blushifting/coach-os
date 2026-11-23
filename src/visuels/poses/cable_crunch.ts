import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Crunch poulie haute.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_crunch: PoseExercice = {
  id: 'cable_crunch',
  camera: { tour: 75, hauteur: 12 },
  mainFermee: true,
  materiel: [{ type: 'poulie', pos: [0, 0, 98], tour: 180, hauteur: 198, prise: { type: 'corde' } }],
  cles: [
    pose({
      bassin: { pos: [0, 54.5, 1], bascule: 18 },
      lombaires: { flex: 2 },
      thorax: { flex: 2 },
      bras: { cible: { repere: 'thorax', pos: [13, 50, 12], pole: [0.4, -0.6, 1] } },
      jambe: { cible: { pos: [11, 16.47, -40.3], pole: [0, -1, 0.4], tour: 0, pointe: 70 } },
    }),
    pose({
      bassin: { pos: [0, 53, -5], bascule: 40 },
      lombaires: { flex: 26 },
      thorax: { flex: 30 },
      cou: { flex: 14 },
      bras: { cible: { repere: 'thorax', pos: [13, 50, 12], pole: [0.4, -0.6, 1] } },
      jambe: { cible: { pos: [11, 16.47, -40.3], pole: [0, -1, 0.4], tour: 0, pointe: 70 } },
    }),
  ],
  valide: true,
};
