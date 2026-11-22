import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Traction.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pullup: PoseExercice = {
  id: 'pullup',
  camera: { tour: 205, hauteur: 6 },
  mainFermee: true,
  materiel: [{ type: 'barreTraction', pos: [0, 0, 0], tour: 0, hauteur: 225, largeur: 120 }],
  cles: [
    pose({
      bassin: { pos: [0, 115.5, -2] },
      bras: {
        clav: [3, 0],
        cible: { repere: 'barre', pos: [36, 0, 0], axe: [1, 0, 0], pole: [1, 0.1, -0.3] },
      },
      jambe: { hanche: { flex: 12 }, genou: 25 },
    }),
    pose({
      bassin: { pos: [0, 155.92, -1.94] },
      thorax: { flex: -12 },
      cou: { flex: -8 },
      bras: {
        clav: [-1.5, 0],
        cible: { repere: 'barre', pos: [36, 0, 0], axe: [1, 0, 0], pole: [0.6, -1, -0.4] },
      },
      jambe: { hanche: { flex: 18 }, genou: 30 },
    }),
  ],
  valide: true,
};
