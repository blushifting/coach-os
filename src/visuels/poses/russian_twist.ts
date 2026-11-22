import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Russian twist.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const russian_twist: PoseExercice = {
  id: 'russian_twist',
  camera: { tour: 20, hauteur: 16 },
  mainFermee: true,
  materiel: [{ type: 'disque', repere: 'thorax', centre: [0, 2, 25], rayon: 12 }],
  cles: [
    pose({
      bassin: { pos: [0, 15.56, 0], bascule: -45 },
      lombaires: { flex: 12, tour: -16.2 },
      thorax: { flex: 8, tour: -19.8 },
      cou: { flex: 10, tour: 10.8 },
      bras: {
        cible: { repere: 'thorax', pos: [12.5, 2, 25], axe: [0, 1, 0], pole: [1, -0.4, -0.3] },
      },
      jambe: { hanche: { flex: 92, abd: 6 }, genou: 72, cheville: -20 },
    }),
    pose({
      bassin: { pos: [0, 15.56, 0], bascule: -45 },
      lombaires: { flex: 12 },
      thorax: { flex: 8 },
      cou: { flex: 10 },
      bras: {
        cible: { repere: 'thorax', pos: [12.5, 2, 25], axe: [0, 1, 0], pole: [1, -0.4, -0.3] },
      },
      jambe: { hanche: { flex: 92, abd: 6 }, genou: 72, cheville: -20 },
    }),
    pose({
      bassin: { pos: [0, 15.56, 0], bascule: -45 },
      lombaires: { flex: 12, tour: 16.2 },
      thorax: { flex: 8, tour: 19.8 },
      cou: { flex: 10, tour: -10.8 },
      bras: {
        cible: { repere: 'thorax', pos: [12.5, 2, 25], axe: [0, 1, 0], pole: [1, -0.4, -0.3] },
      },
      jambe: { hanche: { flex: 92, abd: 6 }, genou: 72, cheville: -20 },
    }),
  ],
  valide: true,
  duree: 1.6,
};
