import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Tirage vertical à la poulie.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const lat_pulldown: PoseExercice = {
  id: 'lat_pulldown',
  camera: { tour: 160, hauteur: 14 },
  mainFermee: true,
  materiel: [{ type: 'tirageVertical', pos: [0, 0, 0], tour: 0, course: [166, 128] }],
  cles: [
    pose({
      bassin: { pos: [0, 62, -4], bascule: -5 },
      cou: { flex: -4 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.2, -0.2] },
      },
      jambe: { cible: { pos: [14, 8, 44], pole: [0, 0.4, 1], tour: 6, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 62, -4], bascule: -14 },
      thorax: { flex: -4 },
      cou: { flex: -8 },
      bras: {
        clav: [-1, -1.5],
        pronation: 90,
        cible: { repere: 'barre', pos: [40, 0, 0], axe: [1, 0, 0], pole: [1, -0.2, -0.2] },
      },
      jambe: { cible: { pos: [14, 8, 44], pole: [0, 0.4, 1], tour: 6, pointe: 0 } },
    }),
  ],
  valide: true,
};
