import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Bûcheron à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const cable_wood_chop: PoseExercice = {
  id: 'cable_wood_chop',
  camera: { tour: 20, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'poulie', pos: [95, 0, 60], tour: -90, hauteur: 198, prise: { type: 'corde' } },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 96, 0], tour: 8 },
      lombaires: { tour: 10 },
      thorax: { penche: -4, tour: 14 },
      brasG: { cible: { repere: 'monde', pos: [26, 136, 40], pole: [0.3, -1, -0.3] } },
      brasD: { cible: { repere: 'monde', pos: [22, 144, 40], pole: [0.2, -1, -0.5] } },
      jambe: { cible: { pos: [20, 8, 0], pole: [0.4, 0, 0.9], tour: 20, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 94, 1], bascule: 8 },
      lombaires: { flex: 4 },
      thorax: { flex: 6 },
      brasG: { cible: { repere: 'monde', pos: [2, 116, 55], pole: [0.6, -1, -0.2] } },
      brasD: { cible: { repere: 'monde', pos: [-2, 124, 55], pole: [-0.6, -1, -0.2] } },
      jambe: { cible: { pos: [20, 8, 0], pole: [0.4, 0, 0.9], tour: 20, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 90, 2], bascule: 14, tour: -14 },
      lombaires: { flex: 6, tour: -10 },
      thorax: { flex: 8, penche: 4, tour: -16 },
      brasG: { cible: { repere: 'monde', pos: [-16, 92, 46], pole: [0.3, -0.5, -1] } },
      brasD: { cible: { repere: 'monde', pos: [-20, 100, 46], pole: [-0.4, -1, 0.3] } },
      jambe: { cible: { pos: [20, 8, 0], pole: [0.4, 0, 0.9], tour: 20, pointe: 0 } },
    }),
  ],
  valide: true,
};
