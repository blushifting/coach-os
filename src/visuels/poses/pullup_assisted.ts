import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Traction assistée machine.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pullup_assisted: PoseExercice = {
  id: 'pullup_assisted',
  camera: { tour: 200, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'assistee', pos: [0, 0, 0], tour: 0, course: [-12, 22.5] }],
  cles: [
    pose({
      bassin: { pos: [0, 115.5, -12] },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [1, 0, -0.2] },
      },
      jambe: { genou: 92 },
    }),
    pose({
      bassin: { pos: [0, 150, -12] },
      thorax: { flex: -8 },
      cou: { flex: -10 },
      bras: {
        pronation: 90,
        cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [1, 0, -0.2] },
      },
      jambe: { genou: 92 },
    }),
  ],
  valide: true,
};
