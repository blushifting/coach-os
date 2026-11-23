import type { PoseExercice } from '../scene';
import { pose } from '../squelette';

/**
 * Pallof press.
 *
 * Écrit par l'atelier des visuels (`visuels.html`) : chaque enregistrement
 * réécrit ce fichier en entier. Retoucher les nombres à la main reste possible ;
 * un commentaire ajouté ici serait perdu au prochain enregistrement.
 */
export const pallof_press: PoseExercice = {
  id: 'pallof_press',
  camera: { tour: 25, hauteur: 14 },
  mainFermee: true,
  materiel: [
    { type: 'poulie', pos: [85, 0, 30], tour: -90, hauteur: 122, prise: { type: 'corde' } },
  ],
  cles: [
    pose({
      bassin: { pos: [0, 94, 0], bascule: 3 },
      brasG: {
        pronation: 90,
        cible: { repere: 'monde', pos: [0, 125, 20], axe: [1, 0, 0], pole: [1, -1, 0] },
      },
      brasD: {
        pronation: 90,
        cible: { repere: 'monde', pos: [0, 116, 20], axe: [1, 0, 0], pole: [-1, -1, 0] },
      },
      jambe: { cible: { pos: [17, 8, 0], pole: [0.17, 0, 0.98], tour: 12, pointe: 0 } },
    }),
    pose({
      bassin: { pos: [0, 94, 0], bascule: 3 },
      brasG: {
        pronation: 90,
        cible: { repere: 'monde', pos: [0, 125, 50], axe: [1, 0, 0], pole: [1, -1, -0.3] },
      },
      brasD: {
        pronation: 90,
        cible: { repere: 'monde', pos: [0, 116, 50], axe: [1, 0, 0], pole: [-1, -1, -0.3] },
      },
      jambe: { cible: { pos: [17, 8, 0], pole: [0.17, 0, 0.98], tour: 12, pointe: 0 } },
    }),
  ],
  valide: true,
};
