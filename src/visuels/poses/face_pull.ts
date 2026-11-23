import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Face pull poulie haute.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const face_pull: PoseExercice = {
  id: 'face_pull',
  camera: { tour: 145, hauteur: 16 },
  mainFermee: true,
  materiel: [{ type: 'poulie', pos: [0, 0, 70], tour: 180, hauteur: 168, prise: { type: 'corde' } }],
  cles: [
    pose({
      bassin: { pos: [0, 97.2, -1], bascule: -3 },
      thorax: { flex: -2 },
      bras: { pronation: 10, cible: { repere: 'monde', pos: [12, 158, 45], pole: [1, -0.6, 0] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, -1], bascule: -3 },
      thorax: { flex: -2 },
      bras: { pronation: 10, cible: { repere: 'monde', pos: [18, 165, 36], pole: [1, -0.3, -0.2] } },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 97.2, -1], bascule: -3 },
      thorax: { flex: -2 },
      bras: {
        clav: [0.5, -1.5],
        pronation: 10,
        cible: { repere: 'monde', pos: [20, 166, 12], pole: [1, -0.35, -0.3] },
      },
      jambe: { cible: { pos: [13, 8, 0], pole: [0.17, 0, 0.98], tour: 10, pointe: 0 } },
    }),
  ],
  valide: true,
};
