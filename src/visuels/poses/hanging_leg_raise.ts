import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Relevé de jambes suspendu.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const hanging_leg_raise: PoseExercice = {
  id: 'hanging_leg_raise',
  camera: { tour: 38, hauteur: 6 },
  mainFermee: true,
  materiel: [{ type: 'barreTraction', pos: [0, 0, 0], tour: 0, hauteur: 225, largeur: 120 }],
  cles: [
    pose({
      bassin: { pos: [0, 114, -2] },
      cou: { flex: 6 },
      bras: {
        clav: [3, 0],
        cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [1, 0.1, -0.3] },
      },
      jambe: { hanche: { flex: 4 }, genou: 6, cheville: -25 },
    }),
    pose({
      bassin: { pos: [0, 114.05, -1.03], bascule: -6 },
      lombaires: { flex: 4 },
      thorax: { flex: 3 },
      cou: { flex: 6 },
      bras: {
        clav: [3, 0],
        cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [1, 0.1, -0.3] },
      },
      jambe: { hanche: { flex: 48 }, genou: 34, cheville: -25 },
    }),
    pose({
      bassin: { pos: [0, 114.55, -6.46], bascule: -12 },
      lombaires: { flex: 16 },
      thorax: { flex: 6 },
      cou: { flex: 6 },
      bras: {
        clav: [3, 0],
        cible: { repere: 'barre', pos: [30, 0, 0], axe: [1, 0, 0], pole: [1, 0.1, -0.3] },
      },
      jambe: { hanche: { flex: 98 }, genou: 10, cheville: -25 },
    }),
  ],
  valide: true,
};
