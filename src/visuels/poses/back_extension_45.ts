import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Hyperextension.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const back_extension_45: PoseExercice = {
  id: 'back_extension_45',
  camera: { tour: 80, hauteur: 10 },
  mainFermee: true,
  materiel: [{ type: 'bancLombaires', pos: [0, 0, 0], tour: 0 }],
  cles: [
    pose({
      bassin: { pos: [0, 79.6, 29.27], bascule: 100 },
      lombaires: { flex: 10 },
      thorax: { flex: 6 },
      cou: { flex: 10 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 79.92, 29.32], bascule: 96.32 },
      lombaires: { flex: 9.33 },
      thorax: { flex: 5.6 },
      cou: { flex: 8.53 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 80.8, 29.34], bascule: 86.25 },
      lombaires: { flex: 7.5 },
      thorax: { flex: 4.5 },
      cou: { flex: 4.5 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 81.97, 29.12], bascule: 72.5 },
      lombaires: { flex: 5 },
      thorax: { flex: 3 },
      cou: { flex: -1 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 83.06, 28.62], bascule: 58.75 },
      lombaires: { flex: 2.5 },
      thorax: { flex: 1.5 },
      cou: { flex: -6.5 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 83.77, 28.1], bascule: 48.68 },
      lombaires: { flex: 0.67 },
      thorax: { flex: 0.4 },
      cou: { flex: -10.53 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
    pose({
      bassin: { pos: [0, 84, 27.88], bascule: 45 },
      cou: { flex: -12 },
      brasG: { cible: { repere: 'thorax', pos: [-9, 17, 15], pole: [0.6, -1, 0.6] } },
      brasD: { cible: { repere: 'thorax', pos: [9, 12, 20], pole: [-0.6, -1, 0.6] } },
      jambe: { cible: { pos: [10, 8, 0], pole: [0, 0, 1], tour: 6, pointe: 0, repere: 'plateau' } },
    }),
  ],
  valide: true,
  effort: 'aller',
};
